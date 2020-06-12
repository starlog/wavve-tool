///////////////////////////////////////////////////////////////////////////////////////////////////
// MongoDB Module
// - REDIS read cached
///////////////////////////////////////////////////////////////////////////////////////////////////
'use strict';

const REDIS_KEY_PREFIX = 'mongodb';

let async = require('async');
let log4js = require('log4js');
let logger = log4js.getLogger();
let moment = require('moment');
require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");
let mongoClient = require('mongodb').MongoClient;
let _ = require('lodash');

let mongodbClients = [];
let util2 = require('../util/util2');
let redisCache = require('./redisCache');

///////////////////////////////////////////////////////////////////////////////////////////////////
// Initialize
//
// configurations example (Can assign multiple interface):
// [
//     {
//         name: 'vod',
//         url: 'mongodb://bh-misc-mongo-prd-01.pooq3.local:27017,.....local:27017,/jaws?replicaSet=pooqbhmisRS0&readPreference=secondaryPreferred',
//         options: {poolSize: 1, connectTimeoutMS: 500, useNewUrlParser: true},
//         usecache: true,
//         cachettl: 300
//     }
// ]
//         name: 호출에 사용할 이름
//         url: mongodb connection url
//         options: mongodb connection option
//         useRedis: REDIS cache 사용 여부 (true | false)
//         RedisTtl: REDIS cache TTL (msec)
///////////////////////////////////////////////////////////////////////////////////////////////////
exports.init = function (configurations, callback)
{
    logger.debug('mongodb init start');
    let jobs = [];

    configurations.forEach(function (config)
    {
        jobs.push(async.apply(initMongo, config, mongodbClients))
    });

    async.parallel(jobs, function (err, result)
    {
        if (err)
        {
            logger.error('mongodb:init err=' + err);
            callback(err);
        }
        else
        {
            logger.info('mongodb initialize success');
            logger.debug('connection list is ' + JSON.stringify(result));
            callback(null);
        }
    });
};
///////////////////////////////////////////////////////////////////////////////////////////////////
exports.find = function (queryObject, callback)
{

    _find(queryObject.name, queryObject.db, queryObject.collection, queryObject.query, queryObject.sort,
        queryObject.fields, queryObject.skip, queryObject.limit, function (err, result)
        {
            if (!util2.isProduction())
            {
                logger.debug('mongo.find' + util2.debugDump(result, 3, 200));
            }
            callback(err, result);
        });
};

///////////////////////////////////////////////////////////////////////////////////////////////////
exports.findOne = function (queryObject, callback)
{
    _findOne(queryObject.name, queryObject.db, queryObject.collection, queryObject.query, queryObject.fields,
        function (err, result)
        {
            if (!util2.isProduction())
            {
                logger.debug('mongo.findOne' + util2.debugDump(result, 3, 200));
            }
            callback(err, result);
        });
};

///////////////////////////////////////////////////////////////////////////////////////////////////
exports.deleteOne = function (queryObject, callback)
{
    _deleteOne(queryObject.name, queryObject.db, queryObject.collection, queryObject.query,
        function (err)
        {
            if (!util2.isProduction())
            {
                logger.debug('mongo.deleteOne result = ' + err + ' Query=' + util2.stringify2(queryObject.query));
            }
            callback(err);
        });
};
///////////////////////////////////////////////////////////////////////////////////////////////////
exports.deleteMany = function (queryObject, callback)
{
    _deleteMany(queryObject.name, queryObject.db, queryObject.collection, queryObject.query,
        function (err)
        {
            if (!util2.isProduction())
            {
                logger.debug('mongo.deleteOne result = ' + err + ' Query=' + util2.stringify2(queryObject.query));
            }
            callback(err);
        });
};

///////////////////////////////////////////////////////////////////////////////////////////////////
exports.updateOne = function (queryObject, callback)
{
    _updateOne(queryObject.name, queryObject.db, queryObject.collection, queryObject.query, queryObject.newValue,
        function (err)
        {
            if (!util2.isProduction())
            {
                logger.debug('mongo.updateOne result = ' + err + ' Query=' + util2.stringify2(queryObject.query));
            }
            callback(err);
        });
};
///////////////////////////////////////////////////////////////////////////////////////////////////
exports.insertOne = function (queryObject, callback)
{
    _insertOne(queryObject.name, queryObject.db, queryObject.collection, queryObject.newValue,
        function (err)
        {
            if (!util2.isProduction())
            {
                logger.debug('mongo.insertOne result = ' + err + ' newValue=' + util2.stringify2(queryObject.newValue));
            }
            callback(err);
        });
};
///////////////////////////////////////////////////////////////////////////////////////////////////
exports.insertMany = function (queryObject, callback)
{
    _insertMany(queryObject.name, queryObject.db, queryObject.collection, queryObject.newValue,
        function (err)
        {
            if (!util2.isProduction())
            {
                logger.debug('mongo.insertOne result = ' + err + ' newValue=' + util2.stringify2(queryObject.newValue));
            }
            callback(err);
        });
};


///////////////////////////////////////////////////////////////////////////////////////////////////
// Internal functions
///////////////////////////////////////////////////////////////////////////////////////////////////
function initMongo(config, connectionArray, callback)
{
    mongoClient.connect(config.url, config.options)
        .then(function (client)
        {
            logger.debug('mongodb:initMongo connection success for ' + config.name);
            mongodbClients.push({
                name: config.name,
                client: client,
                useRedis: config.useRedis,
                RedisTtl: config.RedisTtl
            });
            callback(null, config.name);
        }).catch(function (err)
    {
        callback('mongodb:connection error=' + err, config.name);
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function getMongoClient(name)
{
    let _retObject;

    for (let i = 0; i < mongodbClients.length; i++)
    {
        if (mongodbClients[i].name === name)
        {
            _retObject = mongodbClients[i];
            break;
        }
    }
    return _retObject;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function _find(name, db, collection, query, sort, fields, skip, limit, callback)
{
    let mongoObject = getMongoClient(name);

    if (util2.isNullOrUndefinedOrEmpty(mongoObject.name))
    {
        callback('No mongoClient found for name:' + name, null);
    }
    else
    {
        if (mongoObject.useRedis)
        {
            let REDIS_KEY =
                util2.genHashKey(REDIS_KEY_PREFIX, {
                    mode: 'find',
                    name: name,
                    db: db,
                    collection: collection,
                    query: query,
                    sort: sort,
                    fields: fields,
                    skip: skip,
                    limit: limit
                });

            redisCache.get(REDIS_KEY, function (err, result)
            {
                if (!err)
                {
                    logger.debug('mongodb:find - REDIS Cached, key=' + REDIS_KEY);
                    callback(null, result);
                }
                else
                {
                    logger.debug('mongodb:find - REDIS NOT Cached, key=' + REDIS_KEY);
                    mongoObject.client.db(db).collection(collection).find(query).sort(sort)
                        .project(fields).skip(skip).limit(limit).toArray(function (err, docs)
                    {
                        if (err || !docs)
                        {
                            callback('Mongodb found none', null);
                        }
                        else
                        {
                            redisCache.set(REDIS_KEY, docs, mongoObject.RedisTtl, function (err)
                            {
                                callback(null, docs);
                            });
                        }
                    });
                }
            });
        }
        else // No cache version
        {
            mongoObject.client.db(db).collection(collection).find(query).project(fields).sort(sort)
                .skip(skip).limit(limit).toArray(function (err, docs)
            {
                logger.debug('mongodb:find - NO REDIS connection');
                if (err || !docs)
                {
                    callback('Mongodb found none', null);
                }
                else
                {
                    callback(null, docs);
                }
            });

        }
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function _findOne(name, db, collection, query, fields, callback)
{
    let mongoObject = getMongoClient(name);

    if (util2.isNullOrUndefinedOrEmpty(mongoObject.name))
    {
        callback('No mongoClient found for name:' + name, null);
    }
    else
    {
        if (mongoObject.useRedis)
        {
            let REDIS_KEY =
                util2.genHashKey(REDIS_KEY_PREFIX, {
                    mode: 'findOne',
                    name: name,
                    db: db,
                    collection: collection,
                    query: query,
                    sort: sort,
                    fields: fields,
                    skip: skip,
                    limit: limit
                });

            redisCache.get(REDIS_KEY, function (err, result)
            {
                if (!err)
                {
                    logger.debug('mongodb:findOne - REDIS Cached, key=' + REDIS_KEY);
                    callback(null, result);
                }
                else
                {
                    logger.debug('mongodb:findOne - REDIS NOT Cached, key=' + REDIS_KEY);
                    mongoObject.client.db(db).collection(collection).findOne(query, {projection: fields}, function (err, docs)
                    {
                        if (err || !docs)
                        {
                            callback('Mongodb found none', null);
                        }
                        else
                        {
                            redisCache.set(REDIS_KEY, docs, mongoObject.RedisTtl, function (err)
                            {
                                callback(null, docs);
                            });
                        }
                    });
                }
            });
        }
        else // No cache version
        {
            mongoObject.client.db(db).collection(collection).findOne(query, {projection: fields}, function (err, docs)
            {
                logger.debug('mongodb:findOne - NO REDIS connection');
                if (err || !docs)
                {
                    callback('Mongodb found none', null);
                }
                else
                {
                    callback(null, docs);
                }
            });

        }
    }
}


///////////////////////////////////////////////////////////////////////////////////////////////////
function _deleteOne(name, db, collection, query, callback)
{
    let mongoObject = getMongoClient(name);

    if (util2.isNullOrUndefinedOrEmpty(mongoObject.name))
    {
        callback('No mongoClient found for name:' + name, null);
    }
    else
    {
        mongoObject.client.db(db).collection(collection).deleteOne(query, function (err)
        {
            callback(err);
        });
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function _deleteMany(name, db, collection, query, callback)
{
    let mongoObject = getMongoClient(name);

    if (util2.isNullOrUndefinedOrEmpty(mongoObject.name))
    {
        callback('No mongoClient found for name:' + name, null);
    }
    else
    {
        mongoObject.client.db(db).collection(collection).deleteMany(query, function (err)
        {
            callback(err);
        });
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function _updateOne(name, db, collection, query, newValue, callback)
{
    let mongoObject = getMongoClient(name);

    if (util2.isNullOrUndefinedOrEmpty(mongoObject.name))
    {
        callback('No mongoClient found for name:' + name, null);
    }
    else
    {
        mongoObject.client.db(db).collection(collection).updateOne(query, newValue, {upsert: true}, function (err)
        {
            callback(err);
        });
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function _insertOne(name, db, collection, newValue, callback)
{
    let mongoObject = getMongoClient(name);

    if (util2.isNullOrUndefinedOrEmpty(mongoObject.name))
    {
        callback('No mongoClient found for name:' + name, null);
    }
    else
    {
        mongoObject.client.db(db).collection(collection).insertOne(newValue, function (err)
        {
            callback(err);
        });
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function _insertMany(name, db, collection, newValue, callback)
{
    let mongoObject = getMongoClient(name);

    if (util2.isNullOrUndefinedOrEmpty(mongoObject.name))
    {
        callback('No mongoClient found for name:' + name, null);
    }
    else
    {
        mongoObject.client.db(db).collection(collection).insertMany(newValue, function (err)
        {
            callback(err);
        });
    }
}