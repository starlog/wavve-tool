///////////////////////////////////////////////////////////////////////////////////////////////////
// myCache replacement, Felix
// 응용프로그램에서 initialize를 하면 redis로, 하지 않으면 기존 메모리 캐시를 사용한다.
// 오브젝트르 set하는 경우 자동으로 JSON String으로 변환하여 redis에 저장하고,
// get 하는 경우 다시 오브젝트로 변환해준다.
//
// 초기화를 하지 않고 사용하면 REDIS가 아닌 node-cache를 사용하게 된다. (로컬 캐싱)
///////////////////////////////////////////////////////////////////////////////////////////////////
'use strict';

let async = require('async');
const NodeCache = require('node-cache');
const myCache = new NodeCache({stdTTL: 100});
let Redis = require('ioredis');
let util = require('util');
let log4js = require('log4js');
let logger = log4js.getLogger();
const util2 = require('../util/util2');
let _ = require('lodash');
let _redisClient = null;
let _redisMaster = null;

let _isRedisConnected = false;
let _isRedisInitialized = false;


///////////////////////////////////////////////////////////////////////////////////////////////////
exports.init = function (redisSentinels, redisName, callback)
{
    redisInit(redisSentinels, redisName, function (err, result)
    {
        if (err)
        {
            logger.info('redisCache:init, err=' + err + ', result=' + result);
            _isRedisInitialized = false;
        }
        else
        {
            logger.info('redisCache initialize success');
            _isRedisInitialized = true;
        }

        callback(err, result);
    });
};
///////////////////////////////////////////////////////////////////////////////////////////////////
exports.ttl = function (cachekey, callback)
{
    if (_isRedisInitialized)
    {
        _redisClient.ttl(cachekey, function (err, result)
        {
            callback(result);
        });
    }
    else
    {
        myCache.getTtl(cachekey, function (err, result)
        {
            callback(result);
        });
    }
};

///////////////////////////////////////////////////////////////////////////////////////////////////
// GET
//
// REDIS에 저장되어 있는 데이타를 리턴한다.
// JSON string인 경우에는 object로 변환해서 리턴한다.
// 빈 데이타인 경우에도 err를 리턴한다.
///////////////////////////////////////////////////////////////////////////////////////////////////
exports.get = function (cachekey, callback)
{
    if (_isRedisInitialized)
    {
        logger.debug('using redis cache');
        redisGetVal(_redisClient, cachekey, function (err, result)
        {
            if (err)
            {
                logger.debug('redisCache:get, err=' + err + ', result=' + result);
                callback(true, null);
                // 에러가 발생하면 에러 + 빈 데이타 리턴
            }
            else
            {
                if (result)
                {
                    logger.debug('redisCache:get, err=' + err + ', result=' + result);
                    callback(null, result);
                    // 데이타가 존재하면 성공으로 리턴
                }
                else
                {
                    callback(true, result);
                    // 데이타가 비어 있으면 실패로 리턴
                }
            }
        });
    }
    else
    {
        logger.debug('using node.js cache');
        let result = myCache.get(cachekey);

        let returnStructure;
        try
        {
            returnStructure = JSON.parse(result);
        }
        catch (e)
        {
            logger.debug('exports.get try-catch for JSON.parse err=' + e);
            returnStructure = result;
        }

        if (util2.isNullOrUndefinedOrEmpty(result))
        {
            callback('nothing', returnStructure);
        }
        else
        {
            callback(null, returnStructure);
        }
    }
};

///////////////////////////////////////////////////////////////////////////////////////////////////
// SET
//
// REDIS에 저장한다.
// ttl은 초단위다
///////////////////////////////////////////////////////////////////////////////////////////////////
exports.set = function (cachekey, value, ttl, callback)
{
    if (value)
    {
        if (_isRedisInitialized)
        {
            logger.debug('using redis cache');
            redisSetVal(_redisMaster, cachekey, value, ttl, function (err, result)
            {
                if (err)
                {
                    logger.info('redisCache:set, err=' + err + ', result=' + result);
                }
                callback(err, result);
            });
        }
        else
        {
            let saveData;
            logger.debug('using node.js cache');
            try
            {
                saveData = JSON.stringify(value);
            }
            catch (e)
            {
                saveData = result;
            }

            myCache.set(cachekey, saveData, ttl);
            callback(null, value);
        }

    }
    else //데이타가 null이면 저장하지 않고 그냥 성공 리턴
    {
        callback(null, null);
    }
};

exports.setBulk = function (keyValueList, ttl, callback)
{
    if (!keyValueList[0] || !keyValueList[0].key || !keyValueList[0].value)
    {
        callback('List must have "key" and "value" properties.');
    }
    else
    {
        if (_isRedisInitialized)
        {
            redisSetBulk(_redisMaster, keyValueList, ttl, function (err, result)
            {
                if (err)
                {
                    logger.info('redisCache:setBulk, err=' + err + ', result=' + result);
                }
                callback(err, result);
            });
        }
        else
        {
            callback('Cannot use setBulk without redis initialization');
        }
    }
};
///////////////////////////////////////////////////////////////////////////////////////////////////
exports.del = function (cachekey, callback)
{
    redisDelVal(_redisMaster, cachekey, function (err)
    {
        callback(err);
    });
};


///////////////////////////////////////////////////////////////////////////////////////////////////
// REDIS functions
///////////////////////////////////////////////////////////////////////////////////////////////////
function redisInit(sentinels, name, callback)
{
    _redisClient = new Redis({
        sentinels: sentinels,
        role: 'slave',
        name: name
    });

    _redisMaster = new Redis({
        sentinels: sentinels,
        role: 'master',
        name: name
    });

    _redisClient.ping(function (err, result)
    {
        if (err)
        {
            _isRedisConnected = !err;
            callback(err, result);
        }
        else
        {
            _redisMaster.ping(function (err, result)
            {
                _isRedisConnected = !err;
                callback(err, result);
            });
        }
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// REDIS functions
///////////////////////////////////////////////////////////////////////////////////////////////////
function redisSetVal(redisclient, key, value, ttl, callback)
{
    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Sanity check
    ///////////////////////////////////////////////////////////////////////////////////////////////
    if (!_isRedisConnected)
    {
        callback(false, 'Redis not connected', null);
    }

    let stringvalue;

    try
    {
        stringvalue = JSON.stringify(value);
        logger.debug('redisSetVal stringfy data=' + stringvalue);
    }
    catch (e)
    {
        logger.debug('redisSetVal stringfy try-catch error=' + e);
        stringvalue = value;
    }

    logger.debug('redisSetVal stringvalue=' + stringvalue);
    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Action
    ///////////////////////////////////////////////////////////////////////////////////////////////
    try
    {
        let TTL;
        if (util2.isNullOrUndefined(ttl))
        {
            TTL = 60 * 5; //Default 5 minutes
        }
        else
        {
            TTL = ttl;
        }

        if (TTL === -1)
        {
            redisclient.set(key, stringvalue, function (err, result)
            {
                callback(err, result);
            });
        }
        else
        {
            redisclient.set(key, stringvalue, 'EX', TTL, function (err, result)
            {
                callback(err, result);
            });
        }
    }
    catch (exception)
    {
        callback(exception);
    }
}

function redisSetBulk(redisclient, keyValueList, ttl, callback)
{
    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Sanity check
    ///////////////////////////////////////////////////////////////////////////////////////////////
    if (!_isRedisConnected)
    {
        callback(false, 'Redis not connected', null);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Action
    ///////////////////////////////////////////////////////////////////////////////////////////////
    try
    {
        let _keyValueLsit = _.clone(keyValueList);

        let TTL;
        if (util2.isNullOrUndefined(ttl))
        {
            TTL = 60 * 5; //Default 5 minutes
        }
        else
        {
            TTL = ttl;
        }
        async.until(
            function test(callback) // 계속 진행해야 하는지 확인하는 펑션, callback(null,true)리턴하면 중단
            {
                callback(null, _keyValueLsit.length === 0);
            },
            function iter(callback) // 실제 작업 펑션
            {
                let _data = _keyValueLsit.pop();
                if (TTL === -1)
                {
                    redisclient.set(_data.key, _data.value, function (err)
                    {
                        callback(err);
                    });
                }
                else
                {
                    redisclient.set(_data.key, _data.value, 'EX', TTL, function (err)
                    {
                        callback(err);
                    });
                }
            },
            function done(err) // 완료 펑션
            {
                callback(err);
            });
    }
    catch (exception)
    {
        callback(exception);
    }
}


function redisDelVal(redisclient, key, callback)
{
    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Sanity check
    ///////////////////////////////////////////////////////////////////////////////////////////////
    if (!_isRedisConnected)
    {
        callback(false, 'Redis not connected', null);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Action
    ///////////////////////////////////////////////////////////////////////////////////////////////
    try
    {
        redisclient.del(key, function (err, result)
        {
            callback(err);
        });
    }
    catch (exception)
    {
        callback(exception);
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// REDIS functions
///////////////////////////////////////////////////////////////////////////////////////////////////
function redisGetVal(redisclient, key, callback)
{
    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Sanity check
    ///////////////////////////////////////////////////////////////////////////////////////////////
    if (!_isRedisConnected)
    {
        callback('Redis not connected.', null);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Action
    ///////////////////////////////////////////////////////////////////////////////////////////////
    try
    {
        redisclient.get(key, function (err, result)
        {
            if (err)
            {
                callback(err, null);
            }
            else
            {
                if (util2.isNullOrUndefined(result))
                {
                    callback('Redis:No result for key=' + key, null);
                }
                else
                {

                    let returnStructure;

                    try
                    {
                        returnStructure = JSON.parse(result);
                    }
                    catch (e)
                    {
                        returnStructure = result;
                    }
                    callback(null, returnStructure);
                }
            }
        });
    }
    catch (exception)
    {
        callback(exception, null);
    }
}
