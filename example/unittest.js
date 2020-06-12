'use strict';
let emergency = require('../lib/interface/emergency');
let httpclient = require('../lib/interface/httpclient');
let mongodb = require('../lib/interface/mongodb');
let redisCache = require('../lib/interface/redisCache');
let circuitBreaker = require('../lib/util/circuitBreaker');
let lap = require('../lib/util/lap');
let util2 = require('../lib/util/util2');
let async = require('async');

const mongoConnections = [
    {
        name: 'contents',
        url: 'mongodb://'
            + 'mongo-contents1-01.local.wavve.com:27017,'
            + 'mongo-contents1-02.local.wavve.com:27017,'
            + 'mongo-contents1-03.local.wavve.com:27017,'
            + 'mongo-contents1-04.local.wavve.com:27017,'
            + 'mongo-contents1-05.local.wavve.com:27017,'
            + 'mongo-contents1-06.local.wavve.com:27017,'
            + 'mongo-contents1-07.local.wavve.com:27017,'
            + 'mongo-contents1-08.local.wavve.com:27017,'
            + 'mongo-contents1-09.local.wavve.com:27017,'
            + 'mongo-contents1-10.local.wavve.com:27017,'
            + 'mongo-contents1-11.local.wavve.com:27017,'
            + 'mongo-contents1-12.local.wavve.com:27017,'
            + 'mongo-contents1-13.local.wavve.com:27017,'
            + '?replicaSet=wavveContents1RS0&readPreference=secondaryPreferred',
        options: {
            poolSize: 5,
            connectTimeoutMS: 2000,
            useNewUrlParser: true,
            useUnifiedTopology: true // 사용하면 에러발생
        },
        useRedis: false,
        RedisTtl: 60
    }
];
const mongoConnectionsWithRedis = [
    {
        name: 'contents',
        url: 'mongodb://'
            + 'mongo-contents1-01.local.wavve.com:27017,'
            + 'mongo-contents1-02.local.wavve.com:27017,'
            + 'mongo-contents1-03.local.wavve.com:27017,'
            + 'mongo-contents1-04.local.wavve.com:27017,'
            + 'mongo-contents1-05.local.wavve.com:27017,'
            + 'mongo-contents1-06.local.wavve.com:27017,'
            + 'mongo-contents1-07.local.wavve.com:27017,'
            + 'mongo-contents1-08.local.wavve.com:27017,'
            + 'mongo-contents1-09.local.wavve.com:27017,'
            + 'mongo-contents1-10.local.wavve.com:27017,'
            + 'mongo-contents1-11.local.wavve.com:27017,'
            + 'mongo-contents1-12.local.wavve.com:27017,'
            + 'mongo-contents1-13.local.wavve.com:27017,'
            + '?replicaSet=wavveContents1RS0&readPreference=secondaryPreferred',
        options: {
            poolSize: 5,
            connectTimeoutMS: 2000,
            useNewUrlParser: true,
            useUnifiedTopology: true // 사용하면 에러발생
        },
        useRedis: true,
        RedisTtl: 60
    }
];

const redisConnections = {
    sentinels: [
        {host: 'redis-common-01.local.wavve.com', port: 26379},
        {host: 'redis-common-02.local.wavve.com', port: 26379},
        {host: 'redis-common-03.local.wavve.com', port: 26379}
    ],
    name: 'common-redis-sentinel'
};

test(); // 테스트 실행

///////////////////////////////////////////////////////////////////////////////////////////////////
function test()
{
    console.log('unit test start');
    let storage = {data: {}};

    async.series([
        setdebug,
        async.apply(redisinit, redisConnections),
        async.apply(mongoinit, mongodb, mongoConnectionsWithRedis),
        async.apply(mongotest1, mongodb),
        async.apply(mongotest1, mongodb), // For cache test
        async.apply(httptest1, httpclient),
        async.apply(redisBulktest, redisCache),
        async.apply(redisGet, redisCache, 'a'),
        async.apply(redisGet, redisCache, 'b'),
        async.apply(redisGet, redisCache, 'c'),
        async.apply(redisGet, redisCache, 'd'),
        async.apply(redisGet, redisCache, 'e')

    ], function (err)
    {
        if (err)
        {
            console.log('test result=' + err);
        }
        else
        {
            console.log('test SUCCESS');
        }
    });
}

function setdebug(callback)
{
    util2.setLogLevel();
    callback(null);
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function mongoinit(mongo, mongoConnections, callback)
{
    console.log('mongoinit start');
    mongo.init(mongoConnections, function (err, result)
    {
        if (err)
        {
            console.log('mongoinit err=' + err);
            process.exit(-1);
        }
        else
        {
            console.log('mongoinit end');
            callback(null);
        }
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function redisinit(redisConnections, callback)
{
    console.log('redisinit start');
    redisCache.init(redisConnections.sentinels, redisConnections.name, function (err)
    {
        if (err)
        {
            console.log('redisinit err=' + err);
            process.exit(-1);
        }
        else
        {
            console.log('redisinit end');
            callback(null);
        }
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function mongotest1(mongo, callback)
{
    let queryObject = {
        name: 'contents',
        db: 'vod',
        collection: 'supercontent',
        query: {},
        sort: {},
        fields: {_id: 0, contentid: 1},
        skip: 0,
        limit: 5
    };

    mongo.find(queryObject, function (err, result)
    {
        callback(null);
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function httptest1(http, callback)
{
    let queryObject = {
        method: 'get',
        url: 'https://apis.pooq.co.kr/ip',
        params: {
            apikey: 'E5F3E0D30947AA5440556471321BB6D9',
            credential: 'none',
            device: 'pc',
            drm: 'wm',
            partner: 'pooq',
            pooqzone: 'none',
            region: 'kor',
            targetage: 'auto'
        },
        timeout: 300
    };
    let retryConfig = {
        times: 3,
        interval: 10
    };

    http.call(queryObject, retryConfig, function (err, result)
    {
        if (err)
        {
            console.log('redisinit err=' + err);
            process.exit(-1);
        }
        else
        {
            console.log('result=' + util2.stringify(result.data, null, 2));
            callback(null)
        }
    });
}

function redisBulktest(redisCache, callback)
{
    let testArray = [
        {key: 'a', value: 'val_a'},
        {key: 'b', value: 'val_b'},
        {key: 'c', value: 'val_c'},
        {key: 'd', value: 'val_d'},
        {key: 'e', value: 'val_e'}
    ];

    redisCache.setBulk(testArray, 10, function (err)
    {
        if (err)
        {
            console.log('redisBulktest err=' + err);
            process.exit(-1);
        }
        else
        {
            console.log('redisBulktest SUCCESS');
            callback(null)
        }
    });
}

function redisGet(redisCache, key, callback)
{
    redisCache.get(key, function(err,result){
        if (err)
        {
            console.log('redisGet err=' + err);
            process.exit(-1);
        }
        else
        {
            console.log(result);
            callback(null)
        }
    });
}