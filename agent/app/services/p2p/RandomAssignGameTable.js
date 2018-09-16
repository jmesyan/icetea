var log = require('pomelo-logger').getLogger("hall", "RandomAssignGameTable");
var pomelo = require('pomelo');
var tools = require("../../GameUtils/Tools");

var p2p = require("../StoreDatas").p2p;
var sys = require("../StoreDatas").sys;

var RandomAssignGameTable = function() {
    this.$id = "RandomAssignGameTable";
    this.$scope = "singleton";
    this.init();
};

var service = RandomAssignGameTable.prototype;

service.init = function(){
	if (pomelo.app.getServerType()!="hall") return;
    if (!p2p.mj) p2p.mj = {};
    p2p.mj.codelen = 6; //code长度
    if (!p2p.mj.use) p2p.mj.use = []; //已使用gsidtid数组
    if (!p2p.mj.nouse) p2p.mj.nouse = {}; //未使用gsidtid数组
    if (!p2p.mj.code) p2p.mj.code = {}; //已使用的code=gsidtid对象
    if (!p2p.mj.codesort) p2p.mj.codesort = {};//gsidtid=>code
    if (!p2p.mj.gsidtid) p2p.mj.gsidtid = {}; //已使用的gsidtid=uid对象
    if (!p2p.mj.checkIp) p2p.mj.checkIp = {}; //ip相同不能进入房间
    if (!p2p.mj.checkIp) p2p.mj.checkGps = {}; //创建的房间要限制gps的房号
    if (!p2p.mj.allcode) this.initCode(); //未使用的code数组
    if (!p2p.mj.temptable) setTimeout(function() { pomelo.app.get('temporaryBadTable').initTimer(); }, 2000); //临时坏桌子 10分钟回收
    if (!p2p.mj.dk) p2p.mj.dk = {};
    if (!p2p.mj.aa) p2p.mj.aa = {};
    if (!p2p.mj.club) p2p.mj.club = {};//房间属于哪个俱乐部和包间
};

//加入到已使用
service.addToUse = function(gsidtid, code, uid) {
    if (!gsidtid || !code || !uid) return;
    //log.info('addToUse', gsidtid, code, uid);
    if (p2p.mj.use.indexOf(gsidtid) == -1) p2p.mj.use.push(gsidtid); //加入已使用桌子
    p2p.mj.code[code] = gsidtid; //加入已经使用房号
    p2p.mj.codesort[gsidtid] = code;
    p2p.mj.gsidtid[gsidtid] = [uid]; //当前桌主
};
service.deleteByUse = function(gsidtid, code, maintenane) {
    if (!gsidtid || !code) return;
    //log.info('deleteByUse', gsidtid, code);
    if (p2p.mj.allcode.indexOf(code) == -1) p2p.mj.allcode.push(code); //回收房号
    delete p2p.mj.code[code]; //清理使用的房号
    delete p2p.mj.gsidtid[gsidtid]; //清理桌主
    delete p2p.mj.club[code];//清理包间ID
    delete p2p.mj.codesort[gsidtid];

    while(p2p.mj.use.indexOf(gsidtid) != -1) { var index = p2p.mj.use.indexOf(gsidtid); if (index != -1) p2p.mj.use.splice(index, 1); } //清理使用的桌子
    if (maintenane) {
        delete maintenane.tables[gsidtid];
        return;
    } //维护中不回收桌子
    var gid = gsidtid.split("_")[0];
    if (p2p.mj.nouse[gid].indexOf(gsidtid) == -1) p2p.mj.nouse[gid].push(gsidtid); //回收桌子
};
//回收到未使用
service.addToNotUse = function(gsidtid, code) {
    if (!gsidtid || !code) return;
    //log.info('addToNotUse', gsidtid, code);
    var gid = gsidtid.split("_")[0];
    if (p2p.mj.nouse[gid].indexOf(gsidtid) == -1) p2p.mj.nouse[gid].push(gsidtid); //回收桌子
    if (p2p.mj.allcode.indexOf(code) == -1) p2p.mj.allcode.push(code); //回收房号
};
//房号是否使用
service.getUseTableByCode = function(code) { return p2p.mj.code[code]; };
//返回当前桌主
service.getUserByGSIDTID = function(gsidtid) { return p2p.mj.gsidtid[gsidtid]; };
//是否可以重连
service.checkReconnect = function(gsidtid, uid) {
    var users = this.getUserByGSIDTID(gsidtid);
    if (!users || users.indexOf(uid) == -1) {
        log.error('checkReconnect 失败！', gsidtid, uid, p2p.mj.gsidtid[gsidtid]);
        return false;
    }
    return true;
};
//用户加入到桌子
service.addUserToTable = function(gsidtid, uid) {
    if (!gsidtid || !uid) return;
    //log.info('addUserToTable', gsidtid, uid, p2p.mj.gsidtid[gsidtid]);
    if (!p2p.mj.gsidtid[gsidtid]) p2p.mj.gsidtid[gsidtid] = [uid];
    if (p2p.mj.gsidtid[gsidtid].indexOf(uid) == -1) p2p.mj.gsidtid[gsidtid].push(uid);
};
//移除桌子用户
service.removeTableUser = function(gsidtid, uid) {
    if (!gsidtid || !uid) return;
    //log.info('removeTableUser', gsidtid, uid, p2p.mj.gsidtid[gsidtid]);
    if (!p2p.mj.gsidtid[gsidtid]) return;
    while(p2p.mj.gsidtid[gsidtid].indexOf(uid) != -1) { var index = p2p.mj.gsidtid[gsidtid].indexOf(uid); if (index != -1) p2p.mj.gsidtid[gsidtid].splice(index, 1); }
};
//注册桌子
service.registerTables = function(gsid, tables) {
    var self = this;
    var gid = gsid.split("_")[0];
    if (!p2p.mj.nouse[gid]) p2p.mj.nouse[gid] = [];

    if (tools.isArray(tables)) {
        delete sys['SYS_MAINTENANCE_' + gsid]; //启动后不维护了
        pomelo.app.get('cache').delete('maintenance_' + gsid);

        var use = 0;
        tables.forEach(function(table) {
            var gsidtid = gsid + '_' + table.tid;
            if (table.code && table.ownerid) { //加入已经使用
                use++;
                //加入已经使用的桌子
                if (p2p.mj.use.indexOf(gsidtid) == -1) p2p.mj.use.push(gsidtid);
                //加入已经使用的房号
                if (!p2p.mj.code[table.code]) p2p.mj.code[table.code] = gsidtid;
                //清理未使用的房号
                while(p2p.mj.allcode.indexOf(table.code) != -1) { var index = p2p.mj.allcode.indexOf(table.code); if (index != -1) p2p.mj.allcode.splice(index, 1); }
                self.addUserToTable(gsidtid, table.ownerid);
                //用户重连相应的桌子
                table.uid.forEach(function(uid){
                    if (uid > 0) {
                        self.addUserToTable(gsidtid, uid);
                        var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
                        if (!!player) pomelo.app.get("gameserverManager").reconnectToGame(player);
                    }
                });
            } else { //加入未使用
                if (p2p.mj.nouse[gid].indexOf(gsidtid) == -1) p2p.mj.nouse[gid].push(gsidtid);
            }
        });
        log.info(
            'icetea registerTables',
            gsid, '注册:', tables.length, '使用:', use,
            '总使用桌子:', p2p.mj.use.length, '总可用桌子:', p2p.mj.nouse[gid].length,
            '总可用房号:', p2p.mj.allcode.length
        );
    }
};
//注销桌子
service.removeTable = function(gsid, table) {
    var gsidtid = gsid + '_' + table;
    log.info('icetea removeTable', gsid, table, gsidtid);
    var gid = gsid.split("_")[0];
    while(p2p.mj.nouse[gid].indexOf(gsidtid) != -1) { var index = p2p.mj.nouse[gid].indexOf(gsidtid); if (index != -1) p2p.mj.nouse[gid].splice(index, 1); }
    while(p2p.mj.use.indexOf(gsidtid) != -1) { var index = p2p.mj.use.indexOf(gsidtid); if (index != -1) p2p.mj.use.splice(index, 1); }

    //回收房号
    var code = 0;
    for(var k in p2p.mj.code) {
        if (p2p.mj.code[k] == gsidtid) code = parseInt(k);
    }
    if (code > 0) {
        delete p2p.mj.code[code];
        if (p2p.mj.allcode.indexOf(code) == -1) p2p.mj.allcode.push(code); //回收房号
    }
    delete p2p.mj.gsidtid[gsidtid];
};
//随机桌子
service.randTable = function(gameid) {
    var len = p2p.mj.nouse[gameid] ? p2p.mj.nouse[gameid].length : 0;
    if (len == 0) { log.error('麻将游戏服务器桌子不足!', 'icetea 桌子使用:', p2p.mj.use.length, '桌子剩余:', len, '房号剩余:', p2p.mj.allcode.length); return null; }

    if(len > 10) len = len - 5;

    var index = Math.floor(Math.random()*len);
    var gsidtid = p2p.mj.nouse[gameid][index]; //随机未使用的桌子
    var list = gsidtid.split('_');
    p2p.mj.nouse[gameid].splice(index, 1); //删除已经使用的桌子

    var obj = { gsid: list[0] + "_" + list[1] + "_" + list[2], tid: list[3], code: this.randCode() };
    return obj;
};
//随机房号
service.randCode = function(){
    var len = p2p.mj.allcode.length;
    if (len == 0) { log.error('麻将', p2p.mj.codelen , '位房间不足!'); return 0 }

    var code = p2p.mj.allcode.shift();

    if (!code || p2p.mj.code[code]) return this.randCode();
    return code;
};
//初始化房号
service.initCode = function() {
    p2p.mj.allcode = [];
    var begin = 1; for(var i=1;i<p2p.mj.codelen;i++) begin = begin * 10;
    var end = begin * 10;
    for(var i=begin;i<end;i++) p2p.mj.allcode.push(i);

    var array = p2p.mj.allcode;
    var m = array.length, t, i;
    while (m) {
        i = Math.floor(Math.random() * m--);
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }

    log.info("mj init code", begin, end-1, p2p.mj.allcode.length);
};
//gsid正在使用的桌子数量
service.getUseTableCount = function(gsid) {
    var gid = gsid.split("_")[0];
    var use = 0, nouse = 0; gsid = gsid + '_';
    for (var i in p2p.mj.use)  if (p2p.mj.use[i].indexOf(gsid) == 0) use++;
    for (var i in p2p.mj.nouse[gid])  if (p2p.mj.nouse[gid][i].indexOf(gsid) == 0) nouse++;
    return { use: use, nouse: nouse };
};
//部分维护清理
service.clearMaintenanceServer = function(gsid) {
    var gid = gsid.split("_")[0];
    var list = []; gsid = gsid + '_';
    for (var i in p2p.mj.nouse[gid]) if (p2p.mj.nouse[gid][i].indexOf(gsid) == 0) list.push(p2p.mj.nouse[gid][i]);
    for (var i in list){
        var gsidtid = list[i];
        while(p2p.mj.nouse[gid].indexOf(gsidtid) != -1) { var index = p2p.mj.nouse[gid].indexOf(gsidtid); if (index != -1) p2p.mj.nouse[gid].splice(index, 1); }
    }
    log.error('服务器维护:', JSON.stringify(list));
};

module.exports = {
    name: "hall",
    beans: [{
        id: "RandomAssignGameTable",
        func: RandomAssignGameTable,
        runupdate: 'init',
        scope: "singleton"
    }]
};