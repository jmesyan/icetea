var log = require('pomelo-logger').getLogger("hall", "TemporaryBadTable");

var p2p = require("../StoreDatas").p2p;

var TemporaryBadTable = function() {
    this.$id = "TemporaryBadTable";
    this.$scope = "singleton";
};

var service = TemporaryBadTable.prototype;

//每分钟处理计时器
service.initTimer = function(){
    p2p.mj.temptable = {};
    setInterval(this.clearTempTable, 1000*60); //1分钟
    log.info('临时坏桌子 10分钟回收 计时器启动！');
};
service.clearTempTable = function() {
    var now = Math.round(+new Date());
    var list = [], dieCount = 0;
    for (var k in p2p.mj.temptable) {
        var o = p2p.mj.temptable[k];
        if (now > o.t) {
            list.push(k);
            var gid = k.split("_")[0];
            if (p2p.mj.nouse[gid].indexOf(k) == -1) p2p.mj.nouse[gid].push(k); //回收桌子
            if (p2p.mj.allcode.indexOf(o.code) == -1) p2p.mj.allcode.push(o.code); //回收房号
            log.warn('回收坏桌子', k, o.code, '桌子已使用:', p2p.mj.use.length, '桌子剩余:', p2p.mj.nouse[gid].length, '房号剩余:', p2p.mj.allcode.length);
        } else dieCount++;
    }
    for (var i in list) delete p2p.mj.temptable[list[i]];

    if (list.length == 0){
        log.info('hebeimj 桌子使用:', p2p.mj.use.length,  '房号剩余:', p2p.mj.allcode.length, '临时坏桌子:', dieCount);
        for(var gid in p2p.mj.nouse){
            log.info(gid, '桌子剩余:', p2p.mj.nouse[gid].length);
        }
    }
};
//加入到临时坏桌子列表
service.addTempTable = function(gsidtid, code) {
    var gid = gsidtid.split("_")[0];
    var now = Math.round(+new Date()) + 1000*60*10; //10分钟回收
    p2p.mj.temptable[gsidtid] = { t: now, code: code };
    log.error('出现坏桌子', gsidtid, code, '桌子已使用:', p2p.mj.use.length, '桌子剩余:', p2p.mj.nouse[gid].length, '房号剩余:', p2p.mj.allcode.length);
};

module.exports = {
    name: "hall",
    beans: [{
        id: "TemporaryBadTable",
        func: TemporaryBadTable,
        scope: "singleton"
    }]
};