///////////////////////////////////////////////////////////////////////////////////////////////////
// 비상상황 제어
//
// 사용 방법
// // close 상태거나, half 상태에서 실호출 확률에 들어가면
// if (CB.status === 'close' || (CB.status === 'half' && circuitBreaker.halfTryDecision(CB)))
// {
//     <정상 동작>
//     실패하면
//         circuitBreaker.circuitBreakerCheck(CB, false); // 실패 동작
//         <실패 응답 또는 비상 응답>
//     성공하면
//         circuitBreaker.circuitBreakerCheck(CB, true); // 성공 동작
//         <정상 응답>
// }
// else // open 상태이거나 half 상태에서 실호출 확률에 안들어 가면
// {
//     if(CB.status === 'open') //open 상태일때는 성공으로 호출
//     {
//         circuitBreaker.circuitBreakerCheck(CB, true); // 성공 동작
//     }
// }
///////////////////////////////////////////////////////////////////////////////////////////////////
'use strict';
let moment = require('moment');

///////////////////////////////////////////////////////////////////////////////////////////////////
const MESSAGE_PREFIX = 'CircuitBreaker: ';
let DEBUG = true;

///////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    circuitBreakerCheck: circuitBreakerCheck,
    halfTryDecision: halfTryDecision,
    processCB: processCB,
    setLog: setLog
};

///////////////////////////////////////////////////////////////////////////////////////////////////
// CB structure sample
///////////////////////////////////////////////////////////////////////////////////////////////////
// let CB = {
//     status: 'close', // close, half, open
//     failCount: 0,
//     lastFailTime: null,
//     successCount: 0,
//     modeSwitchTime: null,
//     threshold: {
//         close2openErrorCount: 100,  // close -> open 에러 카운트
//         half2openErrorCount: 10,    // half -> open 으로 돌아가는 에러 카운트
//         half2closeSuccessCount: 20, // half -> close 로 돌아가는 성공 카운트
//         open2halfCheckTimeDuration: 20000, // open -> half 시도하는 시간 주기
//         error2errorDurationLimit: 3000, // 3초 이내의 에러만 의미를 둠
//     },
//     halfTryRatio: 50 // half 시에 실 호출 해볼 비율
// };

///////////////////////////////////////////////////////////////////////////////////////////////////
function setLog(debugState)
{
    DEBUG = debugState;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function processCB(CircuitBreakerStructure, normalOperation, emergencyOperation, funcParam, callback)
{
    ///////////////////////////////////////////////////////////////////////////////////////////////
    // close 또는 half 상태에서 ratio에 들어가면
    ///////////////////////////////////////////////////////////////////////////////////////////////
    if (CircuitBreakerStructure.status === 'close' || (CircuitBreakerStructure.status === 'half' && halfTryDecision(CircuitBreakerStructure)))
    {
        normalOperation(funcParam, function (err, response)
        {
            if (err)
            {
                if (DEBUG && CircuitBreakerStructure.status === 'half')
                {
                    console.log(MESSAGE_PREFIX + 'Trying while half state(try ratio='+CircuitBreakerStructure.halfTryRatio+'%). ERR=' + err);
                }
                circuitBreakerCheck(CircuitBreakerStructure, false); // 실패 동작
                callback(null, response);
            }
            else
            {
                if (DEBUG && CircuitBreakerStructure.status === 'half')
                {
                    console.log(MESSAGE_PREFIX + 'Trying while half state(try ratio='+CircuitBreakerStructure.halfTryRatio+'%). SUCCESS');
                }
                circuitBreakerCheck(CircuitBreakerStructure, true); // 실패 동작
                callback(null, response);
            }
        });
    }
        ///////////////////////////////////////////////////////////////////////////////////////////////
        // open 또는 half 상태에서 ratio에 안 들어가면
    ///////////////////////////////////////////////////////////////////////////////////////////////
    else
    {
        normalOperation(funcParam, function (err, response)
        {
            if (DEBUG && CircuitBreakerStructure.status === 'open')
            {
                circuitBreakerCheck(CircuitBreakerStructure, true); // 성공 동작
            }
            callback(null, response);
        });
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function halfTryDecision(CB)
{
    let retval = false;

    if (Math.random() > (1 - (CB.halfTryRatio / 100)))
    {
        retval = true;
    }
    return retval;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
function circuitBreakerCheck(CB, isSuccess)
{
    let error = !isSuccess;

    if (error)
    {
        CB.successCount = 0; // 에러가 발생하면 success count는 리샛
        if (!CB.lastFailTime) // 최초 에러
        {
            CB.lastFailTime = moment();
            CB.failCount = 1;
        }
        else
        {
            if (moment().diff(CB.lastFailTime, 'miliseconds') < CB.threshold.error2errorDurationLimit) // 에러가 일정 시간 안에 발생했으면
            {
                CB.lastFailTime = moment();
                CB.failCount++;
                if (CB.failCount > (Number.MAX_SAFE_INTEGER - 10000))
                {
                    CB.failCount = 0;
                }

                if (CB.status === 'close')
                {
                    if (CB.failCount > CB.threshold.close2openErrorCount) // threshold를 넘으면
                    {
                        CB.status = 'open';
                        CB.modeSwitchTime = moment();
                        if (DEBUG)
                        {
                            console.log(MESSAGE_PREFIX + 'CLOSE -> OPEN ' + JSON.stringify(CB));
                        }
                    }
                }
                else if (CB.status === 'half')
                {
                    if (CB.failCount > CB.threshold.half2openErrorCount) // threshold를 넘으면
                    {
                        CB.status = 'open';
                        CB.modeSwitchTime = moment();
                        if (DEBUG)
                        {
                            console.log(MESSAGE_PREFIX + 'HALF -> OPEN ' + JSON.stringify(CB));
                        }
                    }
                }
                else if (CB.status === 'open')
                {
                    if (moment().diff(CB.modeSwitchTime, 'milliseconds') > CB.threshold.open2halfCheckTimeDuration)
                    {
                        CB.failCount = 0;
                        CB.status = 'half';
                        CB.modeSwitchTime = moment();
                        if (DEBUG)
                        {
                            console.log(MESSAGE_PREFIX + 'OPEN -> HALF ' + JSON.stringify(CB));
                        }
                    }
                }
            }
            else
            {
                CB.lastFailTime = moment();
                CB.failCount = 0;
            }
        }
    }
    else
    {
        CB.successCount++;
        if (CB.successCount > (Number.MAX_SAFE_INTEGER - 10000))
        {
            CB.successCount = 0;
        }
        if (CB.status === 'open')
        {
            if (moment().diff(CB.modeSwitchTime, 'milliseconds') > CB.threshold.open2halfCheckTimeDuration) // open -> half 테스트 시간을 넘으면
            {
                CB.successCount = 0;
                CB.failCount = 0;
                CB.status = 'half';
                CB.modeSwitchTime = moment();
                if (DEBUG)
                {
                    console.log(MESSAGE_PREFIX + 'OPEN -> HALF ' + JSON.stringify(CB));
                }
            }
        }
        else if (CB.status === 'half')
        {
            if (CB.successCount > CB.threshold.half2closeSuccessCount) // half -> close 성공 카운트를 넘으면
            {
                CB.successCount = 0;
                CB.failCount = 0;
                CB.status = 'close';
                CB.modeSwitchTime = moment();
                if (DEBUG)
                {
                    console.log(MESSAGE_PREFIX + 'HALF -> CLOSE ' + JSON.stringify(CB));
                }
            }
        }
    }
}
