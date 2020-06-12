///////////////////////////////////////////////////////////////////////////////////////////////////
'use strict';
let redis = require('./redisCache');
let log4js = require('log4js');
let logger = log4js.getLogger();

let EMERGENCY_CHECK_TYPE = 'local'; // local | redis
let EMERGENCY_REDIS_KEY = 'wavve_platform_emergency_status';
let EMERGENCY = false;

///////////////////////////////////////////////////////////////////////////////////////////////////
exports.init = function (callback)
{
    if (EMERGENCY_CHECK_TYPE === 'local')
    {
        getEmergencyStatusLocalDirect(function (err, result)
        {
            logger.info('emergency:init Using LOCAL type. status is "' + result + '"');
            callback(null);
        });
    }
    else
    {
        getEmergencyStatusRedisDirect(function (err, result)
        {
            logger.info('emergency:init Using REDIS type. status is "' + result + '"');
            callback(null);
        });
    }
};

///////////////////////////////////////////////////////////////////////////////////////////////////
exports.getEmergencyStatus = function (storage, callback)
{
    storage.emergencyStatus = null;

    if (EMERGENCY_CHECK_TYPE === 'local')
    {
        getEmergencyStatusLocalDirect(function (err, result)
        {
            storage.emergencyStatus = result;
            callback(null);
        });
    }
    else
    {
        getEmergencyStatusRedisDirect(function (err, result)
        {
            storage.emergencyStatus = result;
            callback(null);
        });
    }
};

///////////////////////////////////////////////////////////////////////////////////////////////////
exports.getEmergencyStatusDirect = function (callback)
{
    if (EMERGENCY_CHECK_TYPE === 'local')
    {
        getEmergencyStatusLocalDirect(function (err, result)
        {
            callback(null, result);
        });
    }
    else
    {
        getEmergencyStatusRedisDirect(function (err, result)
        {
            callback(null, result);
        });
    }
};

///////////////////////////////////////////////////////////////////////////////////////////////////
function getEmergencyStatusRedisDirect(callback)
{
    redis.get(EMERGENCY_REDIS_KEY, function (err, result)
    {
        if (!err)
        {
            callback(null, result);
        }
        else
        {
            callback(null, false);
        }
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function getEmergencyStatusLocalDirect(callback)
{
    callback(null, EMERGENCY);
}