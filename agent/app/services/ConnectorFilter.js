var log = require('pomelo-logger').getLogger('hall', 'connector.user');

module.exports = function () {
    return new ConnectorFilter();
};

var ConnectorFilter = function () {
    this.requestQueue = [];
};

var apiFilterWaitCount = 0;
var msgTotalInCount = 0;
var msgTotalOutCount = 0;
var apiFilterWaitCountHighLimit = 100;
var apiFilterWaitCountLowLimit = 30;
var lastDay = 0;

ConnectorFilter.prototype.handlerQueue = function () {
    var handlerQueueCount = apiFilterWaitCountLowLimit - apiFilterWaitCount;
    if (apiFilterWaitCount>0)
        log.info("[connectorQueue]lowLimit : %s, waitCount : %s, queueCount : %s", apiFilterWaitCountLowLimit, apiFilterWaitCount, handlerQueueCount);
    for (var i = 0, len = this.requestQueue.length; i < handlerQueueCount && i < len; i++) {
        var handlerNextItem = this.requestQueue.shift();
        apiFilterWaitCount++;
        //log.info("[queue]pop : %s, apiFilterWaitCount++ : %s", this.requestQueue.length, apiFilterWaitCount);
        process.nextTick(function () {
            handlerNextItem.next();
        })
    }
};

ConnectorFilter.prototype.requestQueuePush = function (queueItem) {
    this.requestQueue.push(queueItem);
    //log.info("[queue]push : %s", this.requestQueue.length);
};

ConnectorFilter.prototype.before = function (msg, session, next) {
    var day = new Date().getDate();
    if (day != lastDay) {
        log.info("msgTotalInCount : %s, msgTotalOutCount : %s", msgTotalInCount, msgTotalOutCount );
        msgTotalInCount = 0;
        msgTotalOutCount = 0;
        lastDay = day;
    }

    msgTotalInCount++;
    /*log.info("[before]msgTotalInCount++ : %s, [direct]apiFilterWaitCount++ : %s, %s",
        msgTotalInCount,
        this.requestQueue.length == 0 && apiFilterWaitCount < apiFilterWaitCountHighLimit ? apiFilterWaitCount+1 : '',
        apiFilterWaitCount < apiFilterWaitCountLowLimit ? 'BeforeCallQueue' : ''
    );*/
    if (this.requestQueue.length > 0) {
        this.requestQueuePush({ next: next })
    } else {
        if (apiFilterWaitCount < apiFilterWaitCountHighLimit) {
            apiFilterWaitCount++;
            next();
            return
        } else {
            this.requestQueuePush({ next: next })
        }
    }

    if (apiFilterWaitCount < apiFilterWaitCountLowLimit) {
        this.handlerQueue()
    }
};

ConnectorFilter.prototype.after = function (err, msg, session, resp, next) {
    apiFilterWaitCount--;
    msgTotalOutCount++;
    /*log.info("[after]apiFilterWaitCount-- : %s, msgTotalOutCount++ : %s, %s",
        apiFilterWaitCount,
        msgTotalOutCount,
        apiFilterWaitCount < apiFilterWaitCountLowLimit ? 'AfterCallQueue' : ''
    );*/
    if (apiFilterWaitCount < apiFilterWaitCountLowLimit) {
        this.handlerQueue()
    }
    next(err, msg);
};
