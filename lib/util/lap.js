///////////////////////////////////////////////////////////////////////////////////////////////////
// Node.js 속도 측정을 위한 utility
//  Async 버전 제공
//
//  사용방법:
//      서비스 초기화시에: lapInitAsync
//      루프 시작시에: lapStartAsync
//      각 랩 마다: lapAsync
//
//      종료 후 결과 획득: lapReportAsyn
//      종료 후 threshold와 비교 및 결과 획득: lapMonitorAsync
//
//  Sample:
//         let Params = {args: args, res: res, returnStructure: returnStructure, Saved: 'init'};
//         let options = engine.get_option();
//         let myStorage = {lapStart: '', lap: []};
//
//         commonLib.waterfall(
//             [
//                 async.apply(lap.lapStartAsync, myStorage),
//                 async.apply(getMSSQLData, Params),
//                 async.apply(lap.lapAsync, myStorage, 'getMSSQLData'),
//                 async.apply(_StatePopulateResult, Params), //결과 조립
//             ], options.CALL_TIMEOUT, //Timeout
//             function (error)
//             {
//                 if (error)
//                 {
//                     logger.error('ERROR-PATH https://apis.pooq.co.kr' + apiPath);
//                     commonLib.FailureProcessing(Params, error, commonLib.ERROR_RETURN_TYPE.MESSAGE);
//                 }
//
//                 lap.lapMonitorAsync(myStorage, SLOW_THRESHOLD, 'https://apis.pooq.co.kr' + apiPath, function (err, result)
//                 {
//                     res.setHeader('x-pooq-timing', result.report.report);
//                     res.setHeader('x-pooq-version', 'BH-13, REDIS Cached');
//                     res.setHeader('x-pooq-execution', Params.Saved);
//                     res.end(JSON.stringify(Params.returnStructure || {}, null, 2));
//                 });
//             });
///////////////////////////////////////////////////////////////////////////////////////////////////
'use strict';
const moment = require('moment');
let log4js = require('log4js');
let logger = log4js.getLogger();
const SystemMonitorString = 'ServiceSlowWarnning';

///////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    lapInitAsync:lapInitAsync, // Lap 초기화
    lapStartAsync:lapStartAsync, // Lap 첫번째 수행
    lapAsync:lapAsync, // 이후 Lap 기록
    lapReportAsync:lapReportAsync, // Lap 결과 추출
    lapMonitorAsync:lapMonitorAsync, // Lap 총 시간이 주어진 시간 보다 느린지 판단
};


///////////////////////////////////////////////////////////////////////////////////////////////////
function lapInitAsync(storage, callback)
{
    storage = {lapStart: '', laps: []};
    callback(null, storage);
}
///////////////////////////////////////////////////////////////////////////////////////////////////
function lapStartAsync(storage, callback)
{
    storage.lapStart = moment();
    storage.laps = [];
    callback(null);
}
///////////////////////////////////////////////////////////////////////////////////////////////////
function lapAsync(storage, title, callback)
{
    let step = {
        title: title,
        time: moment()
    };
    storage.laps.push(step);
    callback(null);
}
///////////////////////////////////////////////////////////////////////////////////////////////////
function lapReportAsync(storage, callback)
{
    _lapReportAsync(storage, function (err, data)
    {
        callback(err, data);
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function lapMonitorAsync(storage, threshold, message, callback)
{
    let returnVal = {
        isSlow: false,
        message: 'NOT SLOW',
        report: ''
    };

    _lapReportAsync(storage, function (err, result)
    {
        returnVal.report = result;
        let timeDiff = moment().diff(storage.lapStart, 'miliseconds');

        if (timeDiff > threshold)
        {
            logger.error(SystemMonitorString + ' Threshold:' + threshold + ', ' + returnVal.report.report + ' ' + message);
            returnVal.message = 'SLOW';
            returnVal.isSlow = true;
        }
        callback(null, returnVal);
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function _lapReportAsync(storage, callback)
{
    let data = {report: '', total: 0};

    if (storage && storage.laps)
    {
        if (storage.laps.length === 0 && storage.lapStart !== null) // Just lapStart
        {
            let step = {title: 'end', time: moment()};
            storage.laps.push(step);
        }
        let now = moment();

        // Record total milliseconds
        data.total = now.diff(storage.lapStart);

        // Lap datas
        data.report = data.report.concat('total:' + now.diff(storage.lapStart) + ', ');
        data.report = data.report.concat(storage.laps[0].title.replace('_', '')
            + ' '
            + storage.laps[0].time.diff(storage.lapStart)
            + ' ');
        for (let i = 1; i < storage.laps.length; i++)
        {
            data.report = data.report.concat(storage.laps[i].title.replace('_', '')
                + ' '
                + storage.laps[i].time.diff(storage.laps[i - 1].time)
                + ' ');
        }
    }
    callback(null, data);
}