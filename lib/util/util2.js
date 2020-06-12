///////////////////////////////////////////////////////////////////////////////////////////////////
// utilities
///////////////////////////////////////////////////////////////////////////////////////////////////
'use strict';
let forge = require('node-forge');
let log4js = require('log4js');
let logger = log4js.getLogger();
let _ = require('lodash');

///////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    isNullOrUndefined: isNullOrUndefined,
    isNullOrUndefinedOrEmpty: isNullOrUndefinedOrEmpty,
    getValueByKey: getValueByKey,
    stringify: stringify,
    stringify2: stringify2,
    debugDump: debugDump,
    getIp: getIp,
    getCountryFromHeader: getCountryFromHeader,
    genHashKey: genHashKey,
    splitContentID: splitContentID,
    splitUNOProfile: splitUNOProfile,
    getFirstTwoLine: getFirstTwoLine,
    getLastItemFromDotList: getLastItemFromDotList,
    str2hex: str2hex,
    setLogLevel: setLogLevel,
    isProduction: isProduction,
    stackOrMessage: stackOrMessage,
    getClientRealIPAzureFromHttpRequest: getClientRealIPAzureFromHttpRequest
};
let _environment; // = 'production'; // 비워두면 환경변수로 설정함
///////////////////////////////////////////////////////////////////////////////////////////////////
// NODE_ENV 값에 따라 로그 수준을 변경한다.
///////////////////////////////////////////////////////////////////////////////////////////////////
function setLogLevel()
{
    if (isProduction())
    {
        console.log('====>running production mode<====');
        logger.level = 'info';
    }
    else
    {
        console.log('====>running development mode<====');
        logger.level = 'debug';
    }
}
///////////////////////////////////////////////////////////////////////////////////////////////////
function isProduction()
{
    if (!_environment)
    {
        _environment = process.env.NODE_ENV;
    }
    return _environment === 'production';
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function isNullOrUndefined(testObject)
{
    let _returnVal = false;
    try
    {
        if (testObject === null || testObject === undefined)
        {
            _returnVal = true;
        }
    }
    catch (e)
    {
        logger.error('isNullOrUndefined err=' + e);
        _returnVal = true;
    }
    return _returnVal;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function isNullOrUndefinedOrEmpty(testObject)
{
    let _returnVal = false;
    try
    {
        if (testObject === null || testObject === undefined)
        {
            _returnVal = true;
        }
        else
        {
            if (typeof testObject === 'object')
            {
                let x = JSON.stringify(testObject);
                _returnVal = x === '{}' || x === '[]';
            }
            else if (typeof testObject === 'number')
            {
                _returnVal = false;
            }
            else if (typeof testObject === 'string')
            {
                _returnVal = testObject.length === 0;
            }
            else if (typeof testObject === 'boolean')
            {
                _returnVal = false;
            }
            else
            {
                logger.error('isNullOrUndefinedOrEmpty need add logic here: ' + typeof testObject);
            }
        }
    }
    catch (e)
    {
        logger.error('isNullOrUndefinedOrEmpty err=' + e);
        _returnVal = true;
    }
    return _returnVal;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function getValueByKey(obj, key)
{
    try
    {
        if (isNullOrUndefined(obj[key]))
        {
            return '';
        }
        return obj[key];
    }
    catch (e)
    {
        logger.error('getValueByKey err=' + e.stack);
        return '';
    }
}


///////////////////////////////////////////////////////////////////////////////////////////////////
// Exception-free JSON.stringfy
///////////////////////////////////////////////////////////////////////////////////////////////////
function stringify(object)
{
    let output = object;
    try
    {
        output = JSON.stringify(object, null, 2);
    }
    catch (e)
    {
        // intentional
    }
    return output;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function stringify2(object)
{
    let output = object;
    try
    {
        output = JSON.stringify(object);
    }
    catch (e)
    {
        // intentional
    }
    return output;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function debugDump(object, arrayLimit, stringLimit)
{
    if (!arrayLimit)
    {
        arrayLimit = 3;
    }
    if (!stringLimit)
    {
        stringLimit = 200;
    }
    let output = object;
    try
    {
        if (_.isArray(object))
        {
            let _copy = _.clone(object);
            _copy = _copy.slice(0, arrayLimit);
            output = '\nDump(' + arrayLimit + ') elements only_______________\n' + JSON.stringify(_copy, null, 2);
        }
        else
        {
            output = '\nDump first(' + stringLimit + ') characters only_______________\n' + JSON.stringify(object, null, 2).substring(0, stringLimit) + '...';
        }
    }
    catch (e)
    {
        // intentional
    }
    return output;
}


///////////////////////////////////////////////////////////////////////////////////////////////////
// AWS version
///////////////////////////////////////////////////////////////////////////////////////////////////
function getIp(header)
{
    try
    {
        let ips = getValueByKey(header, 'x-forwarded-for');
        if (ips !== '')
        {
            let arrIps = ips.split(',');
            if (arrIps.length < 3)
            {
                return '';
            }
            return arrIps[arrIps.length - 3];
        }
        else
        {
            logger.debug('getIP using dummy ip');
            return '127.0.0.1';
        }
    }
    catch (e)
    {
        logger.debug('getIP err=' + e);
        return '127.0.0.1';
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// AWS version
///////////////////////////////////////////////////////////////////////////////////////////////////
function getCountryFromHeader(header)
{
    let country = 'KR';
    try
    {
        country = getValueByKey(header, 'cloudfront-viewer-country');
    }
    catch (e)
    {
        logger.debug('getCountryFromHeader err=' + e);
        // Fail 이여도 문제 없음. 이 경우에는 'KR'을 리턴함
    }
    return country === '' ? 'KR' : country;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function genHashKey(prefix, object)
{

    let md = forge.md.sha512.create();
    if (typeof object === 'object')
    {
        md.update(stringify2(object));
    }
    else
    {
        md.update(object);
    }
    let result = md.digest().toHex();
    logger.debug('genHashKey Generating key for:' + prefix + '-' + stringify2(object) + ' =>' + result);
    return prefix + '-' + result;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function splitContentID(data)
{
    let pos = data.indexOf('.');

    if (pos !== -1)
    {
        return {contentId: data.substring(0, pos), cornerId: data.substring(pos + 1, data.length)};
    }
    else
    {
        return {contentId: data, cornerId: ''};
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function splitUNOProfile(data)
{
    let pos = data.indexOf('.');

    if (pos !== -1)
    {
        return {UNO: data.substring(0, pos), profile: data.substring(pos + 1, data.length)};
    }
    else
    {
        return {UNO: data, profile: ''};
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function getFirstTwoLine(data)
{
    let list = data.split('\n');

    return list[0] + '==>' + list[1];
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function getLastItemFromDotList(data)
{
    let list = data.split('.');
    return list[list.length - 1];
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function str2hex(data)
{
    let hex = '';
    for (let i = 0, l = data.length; i < l; i++)
    {
        hex += data.charCodeAt(i).toString(16)
    }
    return hex;
}
///////////////////////////////////////////////////////////////////////////////////////////////////
function stackOrMessage(err)
{
    if(!isNullOrUndefined(err) && !isNullOrUndefined(err.stack))
    {
        return err.stack;
    }
    else
    {
        return err;
    }
}
///////////////////////////////////////////////////////////////////////////////////////////////////
// Azure CDN을 사용하는 경우에, x-forwarded-for 배열을 검사하여 첫번째 public ip를 리턴한다
///////////////////////////////////////////////////////////////////////////////////////////////////
function getClientRealIPAzureFromHttpRequest(request)
{
    let response = {
        isSuccess: false,
        clientIp: '',
        paddedClientIp:'',
        message: ''

    }

    try
    {
        if(request.headers && request.headers['x-forwarded-for'])
        {
            let headerString = request.headers && request.headers['x-forwarded-for'];
            headerString = headerString.replace(/\s+/g, ''); // 혹시 space가 있는경우 제거
            let ipList = headerString.split(',');

            let isFound = false;
            let isFoundIndex = 0;
            for(let i=0; i < ipList.length; i++)
            {
                let ipPart = ipList[i].split('.');

                if (ipPart[0] === '10' || ipPart[0] === '172' || ipPart[0] === '192')
                {
                    if (ipPart[0] === '172') // B Class test
                    {
                        let secondNumber = Number.parseInt(ipPart[1]);
                        if (secondNumber < 16 || secondNumber > 32)
                        {
                            isFound = true;
                        }
                    }
                    else if (ipPart[0] === '192') // C Class test
                    {
                        if (ipPart[1] !== '168')
                        {
                            isFound = true;
                        }
                    }
                }
                else
                {
                    isFound = true;
                }

                if(isFound)
                {
                    isFoundIndex = i;
                    break;
                }
            }

            if(isFound)
            {
                response.isSuccess = true;
                response.clientIp = ipList[isFoundIndex];

                let ipPart = ipList[isFoundIndex].split('.');
                for (let j = 0; j < 4; j++)
                {
                    ipPart[j] = ('000' + ipPart[j]).substr(-3);
                }
                response.paddedClientIp = ipPart[0] + '.' + ipPart[1] + '.' + ipPart[2] + '.' + ipPart[3];

            }

            return response;
        }
        else
        {
            response.isSuccess = false;
            response.message = 'Cannot find x-forwarded-for';
            return response;
        }
    } catch (ex)
    {
        response.isSuccess = false;
        response.message = ex.message;
        return response;
    }
}