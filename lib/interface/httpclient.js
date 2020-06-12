///////////////////////////////////////////////////////////////////////////////////////////////////
// HTTP Client
///////////////////////////////////////////////////////////////////////////////////////////////////
'use strict';

let async = require('async');
let axios = require('axios');
let log4js = require('log4js');
let logger = log4js.getLogger();
const Agent = require('agentkeepalive');
let _ = require('lodash');
let util2 = require('../util/util2');
let moment = require('moment');
require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");
let Qs = require('qs');
logger.level = 'DEBUG';

const keepAliveAgent = new Agent({
    keepAlive: true,
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketTimeout: 30000 // free socket keepalive for 30 seconds
});

const axiosClient = axios.create({
    contentType: 'application/json',
    keepAlive: true,
    httpAgent: keepAliveAgent,
    responseType: 'json',
    responseEncoding: 'utf-8'
});

//////////////////////////////////////////////////////////////////////////////////////////////////
exports.call = function (queryObject, retryConfig, callback)
{
    if (util2.isNullOrUndefinedOrEmpty(queryObject.method) || util2.isNullOrUndefinedOrEmpty(queryObject.url))
    {
        callback('call:require at least method and url');
    }
    else
    {
        if (!callback)
        {
            logger.error('httpclient:call callback is null');
        }
        let _startTime = moment();

        if (!queryObject.data)
        {
            queryObject.data = null;
        }
        async.retry(
            retryConfig,
            async.apply(_call, queryObject),
            function (err, result)
            {
                let diff = moment().diff(_startTime, 'miliseconds');
                logger.debug('http.call execution time is ' + diff + ' miliseconds.');
                callback(err, result);
            });
    }
};
//////////////////////////////////////////////////////////////////////////////////////////////////
exports.callWithComStatus = function (queryObject, retryConfig, expectedResultCode, callback)
{
    if (!callback)
    {
        logger.error('httpclient:callWithComStatus callback is null');
    }
    if (!queryObject.data)
    {
        queryObject.data = null;
    }

    let _startTime = moment();
    async.retry(
        retryConfig,
        async.apply(_callWithStatusCode, queryObject, expectedResultCode),
        function (err, result)
        {
            let diff = moment().diff(_startTime, 'miliseconds');
            logger.debug('http.callWithComStatus execution time is ' + diff + ' miliseconds.');
            callback(err, result);
        });
};

///////////////////////////////////////////////////////////////////////////////////////////////////
function _call(qo, callback)
{
    logger.debug('_call qo=' + JSON.stringify(qo));
    axiosClient({
        method: qo.method ? qo.method : '',
        url: qo.url ? qo.url : '',
        params: qo.params ? qo.params : {},
        paramsSerializer: function (params)
        {
            return Qs.stringify(params, {arrayFormat: 'brackets'})
        },
        timeout: qo.timeout ? qo.timeout : '300',
        data: qo.data ? qo.data : {},
        headers: qo.headers ? qo.headers : {},
    }).then(function (response)
    {
        if (response.status === 200)
        {
            logger.debug('_call success(1) url=' + qo.url);
            callback(null, response);
        }
        else
        {
            logger.debug('_call fail(1) url=' + qo.url + ' (response.code=' + response.status + ')');
            callback(response.status, response);
        }
    }).catch(function (ex)
    {
        if (ex.stack)
        {
            logger.debug('_callWithStatusCode fail(2) url=' + qo.url + '\n' + ex.stack);
        }
        else
        {
            logger.debug('_callWithStatusCode fail(2) url=' + qo.url + '\n' + ex);
        }
        callback(ex, ex.response);
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function _callWithStatusCode(qo, expectedResultCode, callback)
{
    logger.debug('_callWithstuatusCode qo=' + JSON.stringify(qo));
    axiosClient({
        method: qo.method ? qo.method : '',
        url: qo.url ? qo.url : '',
        params: qo.params ? qo.params : {},
        paramsSerializer: function (params)
        {
            return Qs.stringify(params, {arrayFormat: 'brackets'})
        },
        timeout: qo.timeout ? qo.timeout : '300',
        data: qo.data ? qo.data : {},
        headers: qo.headers ? qo.headers : {},
    }).then(function (response)
    {
        logger.debug('_callWithStatusCode success(1) url=' + qo.url);
        callback(null, response);
    }).catch(function (ex)
    {
        if (ex.response && ex.response.status && expectedResultCode.includes(ex.response.status))
        {
            logger.debug('_callWithStatusCode success(2) url=' + qo.url + '(response.status=' + ex.response.status + ')');
            callback(null, ex.response);
        }
        else
        {
            if (ex.stack)
            {
                logger.debug('_callWithStatusCode(error) url=' + qo.url + '\n' + ex.stack);
            }
            else
            {
                logger.debug('_callWithStatusCode(error) url=' + qo.url + '\n' + ex);
            }
            callback(ex, ex.response);
        }
    });
}
