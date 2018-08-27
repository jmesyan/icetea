var log = require('pomelo-logger').getLogger("hall", "P2PService");
var pomelo = require('pomelo');
var hothelper=require("../HotHelper");
var gsManager=hothelper.getGameServerManager();
var userManager=hothelper.getUserManager();
var GameConst = hothelper.getGameConst();
var Code = hothelper.getCode();
var GamePool = GamePool || hothelper.getGamePool();
var randomAssignGameTable=hothelper.getRandomAssignGameTable();
var sys = require("../StoreDatas").sys;
var p2p = require("../StoreDatas").p2p;
var serversort = require("../StoreDatas").serversort;
var tools = require("../../GameUtils/Tools");
var tablePeopNum = require("../StoreDatas").tablePeopNum;
var sys = require("../StoreDatas").sys;
var kds = require("../StoreDatas").kds;


var GoldService = function() {
    this.$id = "GoldService";
    this.$scope = "singleton";
    this.init();
};

var service = GoldService.prototype;

service.init = function(){
    if (!kds.qsTables) kds.qsTables = {};
    if (!kds.qsPools) kds.qsPools = {};
    if (!kds.qstu)  kds.qstu = {}; //桌子用户
    if (!kds.qsts)  kds.qsts = {}; //桌子状态 1-正常 2-锁定
    if (!kds.qsut)  kds.qsut = {}; //用户所在桌子
    if (!kds.nsMsg) kds.nsMsg = 0;
};

service.createGoldRoom = function(me, session, body, next) {
    var self = this;
    var uid = session.uid;
    log.info('createGoldRoom', uid, JSON.stringify(body));
    if (this.checkSysMaintenance(me, session, next)) return;

    var lockKey = 'gold_createroom_lock_' + uid;
    if (pomelo.app.get('lock').start(lockKey)) return me.error(session, next, 'actionFrequently', 'rel');

    //重连
    var player = userManager.getOnlineUserSort(uid);

    if (player && parseInt(player.mid) > 0) {
        pomelo.app.get('lock').end(lockKey);
        return next(null,{code:Code.FAIL,msg:'已参加比赛,不能参加金币场游戏!'});
    }

    if (player) {
        var serverConfig = gsManager.reconnectToGame(player);
        if (serverConfig) {
            pomelo.app.get('lock').end(lockKey);
            return next(null, { rel: -1 });
        }
    }

    body.ridx = self.randRIDX(body.gid, body.rtype);
    if (!body.ridx) {
        pomelo.app.get('lock').end(lockKey);
        log.error('服务器不足：', body.gid, body.rtype);
        return me.error(session, next, 'serverNotOnline', 'rel');
    }

    //判断场次类型
    if (body.rtype == 3){//雀神场
        var userGolds = player.golds + player.bonus_golds;
        //金币金币量
        pomelo.app.get('cache').getGameRoomStat(body.gid, body.rtype).then(function(roomstat){
            if (!!roomstat){
                var low_golds = parseInt(roomstat.goldsmin);
                var high_golds = parseInt(roomstat.goldsmax);
                if (userGolds < low_golds) {
                    pomelo.app.get('lock').end(lockKey);
                    log.error('金币不足：', body.gid, body.rtype, body.low_golds);
                    return me.error(session, next, 'goldNotEnough', 'rel');
                }

                if(!kds.qsPools[body.gid])  {
                    var gamePool = new GamePool();
                    gamePool.init(body.gid, body.rtype, 30, 'uid');
                    kds.qsPools[body.gid] = gamePool;
                }
                //检查等待桌子
                if (!kds.qsTables[body.gid]) kds.qsTables[body.gid] = [];
                if (!kds.qsts[gsidtid]) kds.qsts[gsidtid] = 1;
                var tables = kds.qsTables[body.gid];
                for (var i = 0; i < tables.length; i++){
                    var table = tables[i];
                    if (!!serversort[table.gsid] && serversort[table.gsid].tablesort) { 
                        var gsidtid = table.gsid + "_" + table.tid;
                        console.log("golds_checkEmpty:", uid, gsidtid,kds.qsts[gsidtid],JSON.stringify(kds.qstu));
                        if (p2p.mj.use.indexOf(gsidtid) != -1 && kds.qstu[gsidtid] && kds.qsts[gsidtid] == 1 && Object.keys(kds.qstu[gsidtid]).length <  4){
                            //检查身上金币是否符合该桌子的倍率
                            var tableBounds = self._getTableBounds(table);
                            if (userGolds >= tableBounds.min && userGolds < tableBounds.max){//进入游戏
                                body.ridx = serversort[table.gsid].ridx;
                                body.tableid = table.tid;
                                kds.qstu[gsidtid][uid] = {uid:uid};
                                kds.qsut[uid] = gsidtid;
                                kds.qsPools[body.gid].removeObj(uid);
                                return self.startGame(session, body, next, lockKey)
                            }
                        }
                    }
                }
                //进入等候池
                var waitPool =  kds.qsPools[body.gid];
                var join = waitPool.addObj({uid:player.uid});
                if (join){
                    waitPool.setPoolParams({low_ratio:3, high_ratio:5, low_golds:low_golds, high_golds:high_golds});
                    waitPool.setCheckKey(uid);
                    if (waitPool.getPoolLength() >= 2){
                        waitPool.removeCheck();
                        var checkId = setInterval(function(){self.checkPool(waitPool)}, 2000);
                        waitPool.setCheckId(checkId);
                    }
                }
                pomelo.app.get('lock').end(lockKey);
                if(!join) log.error('已在雀神场等待池中:', body.gid, body.rtype, uid, JSON.stringify(waitPool.list));
                return next(null, {rel:2, gid:body.gid, rtype:body.rtype, num:waitPool.getPoolLength()});

            } else {
                pomelo.app.get('lock').end(lockKey);
                return next(null, { rel: -1 });
            }
        });
    } else {
        self.startGame(session, body, next, lockKey)
    }
};

service._isMotor = function(uid){
    var uid = uid+ '';
    return uid.indexOf('motor') != -1;
};

service._addRandomMotor = function(gsidtid){
    if (kds.qstu[gsidtid]){
        for(var k=0; k< 4;k++){
            var uid = 'motor_'+k;
            if (!kds.qstu[gsidtid][uid]){
                kds.qstu[gsidtid][uid] = uid;
                break;
            }
        }
    }
};
service.motorRequest = function(body){
    console.log("motorRequest", JSON.stringify(body));
    var self = this;
    var gsid =   body.gid+"_"+body.rtype+"_"+body.ridx;
    var gsidtid = gsid+"_"+body.tid;

    if (kds.qstu[gsidtid]&&kds.qsts[gsidtid] && kds.qsts[gsidtid] == 1) {
        var moterlen = 0, tolen = Object.keys(kds.qsts[gsidtid]).length;
        for(var k in kds.qstu[gsidtid]) if(self._isMotor(k)) moterlen+=1;
        if (tolen < 4 && moterlen <=1) {
            kds.qsts[gsidtid] = 2;
            self._addRandomMotor(gsidtid);
            var server = gsManager.getServerByGSID(gsid);
            if (!!server) {
                server.sendString('03ADDM{0}'.format(body.tid));
                log.info("03ADDM", body.tid);
                setTimeout(function(){kds.qsts[gsidtid] = 1;}, 500);
            } else {
                console.log("没有金币服务器", gsid);
            }
        }
    }
};

service.checkPool = function(pool){
    console.log("checkpool", JSON.stringify(pool));
    pool.checkTimes ++;
    var self = this;
    var uid =  pool.checkKey;
    var player = userManager.getOnlineUserSort(uid);
    if (!player){
        pool.removeObj(uid);
        if (pool.getPoolLength() > 0){
            pool.setCheckKey(pool.list[0].uid);
        }
        self._sendPoolMsg(GameConst.pushCmd.goldsMatch, pool);
        return;
    }
    if (pool.getPoolLength() < 2){
        pool.removeCheck();
        return;
    }
    pool.sortPool(self._ratePool);
    if (pool.getPoolLength() >= 20){
        var desk1 = [], desk2 = [];
        for (var i = 0; i < pool.getPoolLength(); i++ ){
            if (desk1.length >= 4 && desk2.length >= 4) break;
            var iuid = pool.list[i].uid, iplayer = userManager.getOnlineUserSort(iuid);
            if (!iplayer){
                pool.removeObj(iuid);
                continue;
            }
            var tmp = {uid:pool.list[i].uid, golds:parseInt(iplayer.golds+iplayer.bonus_golds)}
            if (desk1.length < 4) desk1.push(tmp);
            else if (desk2.length < 4) desk2.push(tmp);
        }
        self.enterQsRoom(pool, desk1, 0);
        self.enterQsRoom(pool, desk2, 0);
    } else {
        //检查相近
        var userGolds = player.golds + player.bonus_golds;
        var desk = [];
        var minGolds = parseInt(userGolds/pool.low_ratio), maxGolds = parseInt(userGolds*pool.high_ratio);
        for(var i = 0; i < pool.getPoolLength(); i++){
            var iuid = pool.list[i].uid, iplayer = userManager.getOnlineUserSort(iuid);
            if (!iplayer){
                pool.removeObj(iuid);
                continue;
            }
            var tmpGolds = parseInt(iplayer.golds + iplayer.bonus_golds);
            if (desk.length < 4 && tmpGolds > minGolds && tmpGolds < maxGolds){
                var tmp = {uid:pool.list[i].uid, golds:tmpGolds};
                desk.push(tmp);
            }
            if (desk.length >= 4) break;
        }

        if (desk.length < 4){
            if (desk.length >= 2 && pool.checkTimes >= 13){
                var motorslen = 4 - desk.length;
                for(var k = 0; k < motorslen; k++){
                    var mgolds = pool.low_golds + Math.random()*150000;
                    var tmp = {uid:'motor_'+k, golds:mgolds};
                    desk.push(tmp);
                }
                self.enterQsRoom(pool, desk, motorslen);
            } else {
                var low = parseFloat(pool.low_ratio*1.5).toFixed(2), high = parseFloat(pool.high_ratio*1.5).toFixed(2);
                pool.setPoolRatio(low, high);
            }
        } else {
            self.enterQsRoom(pool, desk, 0);
        }

    }

    if (pool.checkTimes >= 150){
        self._sendPoolMsg(GameConst.pushCmd.goldsTimeout, pool);
        pool.clearPool();
        console.log("超过最大检查次数:150次", pool.checkTimes);
    } else {
        self._sendPoolMsg(GameConst.pushCmd.goldsMatch, pool);
    }

};

service._sendPoolMsg = function(cmd, pool){
    for (var i = 0; i < pool.getPoolLength(); i++ ){
        var iuid = pool.list[i].uid, iplayer = userManager.getOnlineUserSort(iuid);
        if (iplayer){
            iplayer.sendMsg(cmd, {gid:pool.gid, rtype:pool.rtype, num:pool.getPoolLength()});
        }
    }
};

service.enterQsRoom = function(pool, desk, motorslen){
    console.log("enterQsRoom", JSON.stringify(desk), pool.gid);
    var self = this, gid = pool.gid, low_ratio = pool.low_ratio, higth_ratio = pool.high_ratio;
    self._lockDesk(pool, desk);
    var tb = randomAssignGameTable.randTableByRoomType(pool.gid, pool.rtype); //随机
    if (tb && tb.gsid && tb.code) {
        tb.users = desk;
        var params =  self._calDesk(pool,desk);
        tb.basic_points =  params.basic_points;
        tb.service_golds =  params.service_golds;
        tb.low_golds =  pool.low_golds;
        tb.high_golds =  pool.high_golds;
        tb.low_ratio = low_ratio;
        tb.high_ratio = higth_ratio;
        var gsid = tb.gsid.split("_");
        var rtype = gsid[1], ridx = gsid[2];
        var obj = {gid:gid, rtype: rtype, ridx:ridx, tableid:tb.tid};
        var enterGdRoom = function(body){
            console.log("enterGdRoom", JSON.stringify(body));
            if (body.rel == 1){
                var cobj = {
                    code:tb.code, gsid:tb.gsid, tid:tb.tid, basic_points:tb.basic_points, low_golds:tb.low_golds,state:0,
                    service_golds:tb.service_golds, high_golds:tb.high_golds, low_ratio:tb.low_ratio, high_ratio:tb.high_ratio,
                };
                pomelo.app.rpc.db.dbRemote.createGoldRooms(null, cobj, function(lid) {
                    tb.lid = lid;
                    var gsidtid  = tb.gsid + "_" + tb.tid;
                    randomAssignGameTable.addToUse(gsidtid, tb.code, desk[0].uid); //加入到已使用
                    kds.qsTables[gid].push(tb);
                    if(!kds.qstu[gsidtid]) kds.qstu[gsidtid] = {};
                    if(!kds.qsts[gsidtid]) kds.qsts[gsidtid] = 1;
                    for(var i in desk){
                        var user = desk[i];
                        kds.qstu[gsidtid][user.uid] = user;
                    }
                    for(var i = 0; i < desk.length; i++){
                        if (self._isMotor(desk[i].uid)) continue;
                        pool.removeObj(desk[i].uid);
                        var player = userManager.getOnlineUserSort(desk[i].uid);
                        if (player) player.sendMsg(GameConst.pushCmd.goldsEnter, {gid:pool.gid, rtype:pool.rtype, num:pool.getPoolLength()});
                        kds.qsut[desk[i].uid] = gsidtid;
                        self.startGameByUid(desk[i].uid, obj);
                    }
                });
            } else {
                self._releaseLock(pool, desk);
            }
        };

        var gobj = {'s2g':tb.basic_points, 'systax':tb.service_golds, 'androidcount':motorslen};
        var server = gsManager.getServerByGSID(tb.gsid);
        if (!!server) {
            server.sendString('03TAPG{0}|{1}|{2}'.format(gsManager.getTick(enterGdRoom), tb.tid, JSON.stringify(gobj)));
            log.info("03TAPG", JSON.stringify(gobj), motorslen);
        } else {
            console.log("没有金币服务器", tb.gsid);
            self._sendNoserverMsg(pool, desk);
        }
    } else {
        self._sendNoserverMsg(pool, desk);
    }
};

service._sendNoserverMsg = function(pool, desk){
    var self = this;
    self._releaseLock(pool, desk);
    if (kds.nsMsg > 10000) kds.nsMsg = 0;
    if (kds.nsMsg%50 == 0) self._sendPoolMsg(GameConst.pushCmd.noGoldServer, pool);
    kds.nsMsg++;
};

service.removePoolUser = function(uid){
    if (!!kds.qsPools){
        for (var gid in kds.qsPools){
            var pool = kds.qsPools[gid];
            var find = pool.findObj(uid);
            if (find.index > -1){
                console.log("removePoolUser", gid, uid);
                pool.removeObj(uid);
                if (pool.getPoolLength() > 0){
                    pool.setCheckKey(pool.list[0].uid);
                } else {
                    pool.removeCheck();
                }
            }
        }
    }
};

service.removeGoldUsers = function(uid){
    var self = this;
    var rgsidtid = arguments[1];
    // console.log("removeGoldUsers", uid, rgsidtid);
    self.removePoolUser(uid);
    var ueuid = !!kds.qsut[uid]? true: false;
    if (ueuid){
        var gsidtid = kds.qsut[uid];
        if (kds.qstu[gsidtid] && kds.qstu[gsidtid][uid]){
            delete kds.qstu[gsidtid][uid];
        }
        delete kds.qsut[uid];
        console.log("removeGoldTableUser",uid,JSON.stringify(kds.qsut), gsidtid, JSON.stringify(kds.qstu[gsidtid]));
    }

    if (!ueuid && !!rgsidtid && kds.qstu[rgsidtid]){
        for (var u in kds.qstu[rgsidtid]){
            if (self._isMotor(u)){
                delete kds.qstu[rgsidtid][u];
                break;
            }
        }
    }
};


service.endGame = function(body){
    var self = this;
    var gsid = body.gid + "_" + body.rtype + "_" + body.ridx;
    var tid = body.tid, code = 0;
    if (!!kds.qsTables){
        for (var gid in kds.qsTables){
            if (body.gid == gid){
                var tables = kds.qsTables[gid];
                for (var i = 0; i < tables.length; i++){
                    var table = tables[i], lid = table.lid;
                    if (table.gsid == gsid && table.tid == tid){
                        console.log("removeGoldsRoom", gsid, tid);
                        code = table.code;
                        var gsidtid = table.gsid + "_" + table.tid;
                        self._clearQsTable(gsidtid);
                        kds.qsTables[gid].splice(i, 1);
                        pomelo.app.rpc.db.dbRemote.removeGoldRooms(null,lid,2,function(){});
                    }
                }
            }
        }
    }

    if (code > 0){
        var gsidtid = gsid + "_" + tid;
        randomAssignGameTable.deleteByUse(gsidtid, code, sys['SYS_MAINTENANCE_' + gsid]); //删除已经使用
    }

    var server = gsManager.getServerByGSID(gsid);
    if (!!server) {
        var table = server.getTable(body.tid);
        if (!!table) table.dispose();
    }


};

service._clearQsTable = function(gsidtid){
    var users = kds.qstu[gsidtid] || {};
    for(var uid in users){
        delete kds.qsut[uid];
    }
    delete kds.qstu[gsidtid];
    delete kds.qsts[gsidtid];
};

service._lockDesk = function(pool, desk){
    var desk_sort = {};
    for(var k in desk){
        desk_sort[desk[k].uid] = desk[k].uid;
    }

    for(var i = 0; i < pool.getPoolLength(); i++){
        if(desk_sort[pool.list[i].uid]){
            pool.removeObj(pool.list[i].uid);
        }
    }
};

service._releaseLock = function(pool, desk){
    var self = this;
    for(var i=0; i < desk.length; i++){
        if (self._isMotor(desk[i].uid)) continue;
        pool.addObj({uid:desk[i].uid});
    }
};

service._ratePool = function (obj1, obj2) {
    var user1 = userManager.getOnlineUserSort(obj1.uid);
    var user2 = userManager.getOnlineUserSort(obj2.uid);
    var val1 = !!user1? parseInt(user1.golds + user1.bonus_golds): 0;
    var val2 = !!user2? parseInt(user2.golds + user2.bonus_golds): 0;
    return val2 - val1;
};

service._calDesk = function(pool, desk){
    var deskMin = desk[0];
    for (var i = 1; i < desk.length; i++){
        if (desk[i].golds < deskMin.golds){
            deskMin = desk[i];
        }
    }
    var minGolds = deskMin.golds;
    var result = {};
    result.basic_points = parseInt(Math.sqrt(minGolds/pool.low_golds*30))*1000;
    result.service_golds = parseInt(Math.sqrt(minGolds/pool.low_golds*15))*1000;
    return result;
};

service._getTableBounds = function(table){
    var bounds = {min:0, max:0};
    bounds.min = Math.pow((table.basic_points/1000), 2)/27*table.low_golds;
    bounds.max =  Math.pow((table.basic_points/1000),2)/27*table.low_golds*table.low_ratio*table.high_ratio;
    return bounds;
};

service.leaveGoldPool = function(me, session, body, next){
    if (!!kds.qsPools[body.gid]){
        var pool = kds.qsPools[body.gid];
        var find = pool.findObj(body.uid);
        if (find.index > -1){
                pool.removeObj(body.uid);
        }
    }
    return next(null, {rel:0});
};

service.randRIDX = function(gid, rtype) {
    var list = [],
        key = gid + "_" + rtype + "_";
    for (var gsid in serversort)
        if (gsid.indexOf(key) == 0 && serversort[gsid].tablesort) {
            if(!sys['SYS_MAINTENANCE_' + gsid]) list.push(serversort[gsid].ridx);
        }
    log.info('randRIDX', gid, rtype, JSON.stringify(list));
    if (list.length == 1) return list[0];
    if (list.length > 1) return list[Math.floor(Math.random() * list.length)];
    return 0;
};
//开始游戏
service.startGameByUid = function(uid, body) {
    log.info('startGameByUid', uid, JSON.stringify(body));
    var msg = { gid: body.gid, rtype: body.rtype, ridx: body.ridx, tableid: body.tableid || 0 ,stype: body.stype || 0 };
    var player = userManager.getOnlineUserSort(uid);
    gsManager.enterToGame(player, msg, player.locale || 'zh_CN', function(result) {
        log.warn('enterToGame', JSON.stringify(result));
        if (result.rel == 0) {
            if (!result.gid) result.gid = body.gid;
            if (!result.rtype) result.rtype = body.rtype;
            if (!result.ridx) result.ridx = body.ridx;
            if (!result.tid) result.tid = body.tid;
            if (!result.room) result.room = body.code;
            console.log("雀神场房间进入成功：", JSON.stringify(result));
        } else {
            console.log("雀神场房间进入失败：", JSON.stringify(result));
        }
    });
};

service.startGame = function(session, body, next, lockKey) {
    var uid = session.uid;
    log.info('startGame', uid, JSON.stringify(body));

    var msg = { gid: body.gid, rtype: body.rtype, ridx: body.ridx, tableid: body.tableid || 0 ,stype: body.stype || 0 };
    var player = userManager.getOnlineUserSort(uid);
    gsManager.enterToGame(player, msg, player.locale || 'zh_CN', function(result) {
        log.warn('enterToGame', JSON.stringify(result));
        if (result.rel == 0) {
            if (!result.gid) result.gid = body.gid;
            if (!result.rtype) result.rtype = body.rtype;
            if (!result.ridx) result.ridx = body.ridx;
            if (!result.tid) result.tid = body.tid;
            if (!result.room) result.room = body.code;
            pomelo.app.get('lock').end(lockKey);
            return next(null, result);
        } else {
            pomelo.app.get('lock').end(lockKey);
            return next(null, result);
        }
    });
};
service.checkSysMaintenance = function(me, session, next) {
    var isTest = [10017, 10029, 10030,10169,10014].indexOf(parseInt(session.uid)) != -1;
    if (isTest) return false;

    if (sys.SYS_MAINTENANCE) {
        me.error(session, next, 'sysMaintenance', 'rel');
    }
    return sys.SYS_MAINTENANCE;
};

//设置金币房桌子上的人数
service.setTablePeopNum = function(body){
    var gsidtid = body.gid + '_' + body.rtype + '_' + body.ridx + '_' + body.tid;
    tablePeopNum[gsidtid] = body.golds | 0;
};
//获取金币房桌子上的人数
service.getTablePeopNum = function(me, session, body, next){
    return next(null,{ code: Code.OK,'getTablePeopNum' : tablePeopNum });
};
//金币房掉落礼券
service.addUserTicket = function(uid,tickets,gid){
    pomelo.app.rpc.db.dbRemote.addTickets(null, uid, tickets, Code.TICKET.GOLDS_USER_TICKET, '金币房大赢家掉落礼券:' + tickets, gid, function(r) {
        var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
        if (r && r.nums > -1 && player) {
            player.ticket = r.nums;
            //log.info('player->' + JSON.stringify(player));
            player.sendMsg(GameConst.pushCmd.ticketChange, { ticket: player.ticket, num: tickets,ticket_use:player.ticket_use,type:1});
        }
    });
}
//金币房掉落
service.drop = function(body){
    console.log('drop',JSON.stringify(body));
    pomelo.app.rpc.db.dbRemote.getActivityConfig(null,32,function(r){
        var gdropout = {};
        if(r){
            for(var key in r) {
                if(!gdropout[r[key].restrict]) gdropout[r[key].restrict] = {};
                if(!gdropout[r[key].restrict][r[key].type]) gdropout[r[key].restrict][r[key].type] = [];
                gdropout[r[key].restrict][r[key].type].push({value:r[key].value,rate:r[key].rate});
            }
        }
        var gc = gdropout[body.rtype];
        if(gc){
            var uids = [],maxscore = 0,haopai = 0,drop = {};;
            for(var key in body.nuserend){
                drop[body.nuserend[key].uid] = {ticket:0,redpack:0};
                if(body.nuserend[key].isgoodcard == 1) haopai = body.nuserend[key].uid;
                if(body.nuserend[key].changescores > maxscore) {
                    maxscore = body.nuserend[key].changescores;
                    uids = []
                    uids.push(body.nuserend[key].uid);
                } else if(body.nuserend[key].changescores == maxscore) uids.push(body.nuserend[key].uid);
            }
            var ticketConfig = gc[1],redpackConfig = gc[2];
            //console.log('ticketConfig',JSON.stringify(ticketConfig));
            //console.log('redpackConfig',JSON.stringify(redpackConfig));
            //金币房礼券掉落
            if(ticketConfig){
                var rate = 0;
                for(var k in ticketConfig) rate += ticketConfig[k].rate;
                var len = uids.length;
                var index = Math.floor(Math.random()*len);
                var uid = uids[index];
                var chance = Math.floor(Math.random()*rate);
                for(var k in ticketConfig) {
                    if(ticketConfig[k].rate > chance){
                        console.log('金币房礼券掉落',uid,ticketConfig[k],chance,rate);
                        if(ticketConfig[k].value > 0) {
                            drop[uid].ticket = ticketConfig[k].value;
                            service.addUserTicket(uid,ticketConfig[k].value,body.gid);
                            pomelo.app.rpc.db.dbRemote.goldsDropLog(null,uid,ticketConfig[k].value,body.gid,body.rtype,body.ridx,3,function(){});
                        }
                        break;
                    } else chance = chance - ticketConfig[k].rate;
                }
            }
            //掉落红包
            if(redpackConfig){
                if(haopai == 0){
                    var len = body.nuserend.length;
                    var index = Math.floor(Math.random()*len);
                    haopai = body.nuserend[index].uid;
                }
                console.log('haopai',haopai);
                if(haopai > 0){
                    var rate = 0;
                    for(var k in redpackConfig) rate += redpackConfig[k].rate;
                    var chance = Math.floor(Math.random()*rate);
                    for(var k in redpackConfig) {
                        if(redpackConfig[k].rate > chance){
                            console.log('金币房红包掉落',haopai,redpackConfig[k],chance,rate);
                            if(redpackConfig[k].value > 0) {
                                drop[haopai].redpack = redpackConfig[k].value;
                                pomelo.app.rpc.db.dbRemote.addUserRedpack(null,haopai,redpackConfig[k].value,function(){});
                                pomelo.app.rpc.db.dbRemote.goldsDropLog(null,haopai,redpackConfig[k].value,body.gid,body.rtype,body.ridx,1,function(){});
                            }
                            break;
                        } else chance = chance - redpackConfig[k].rate;
                    }
                }
            }
            console.log('drop',JSON.stringify(drop));
            for (var i in body.nuserend){
                var player = userManager.getOnlineUserSort(body.nuserend[i].uid);
                if(player) player.sendMsg(GameConst.pushCmd.drop,{drop:drop});
            }
        }
    });
}

service.dropRedpack = function(){

}

//设置黑名单
service.goldsBlackList = function(gids, uid, gtype){
    if (!gids) return;
    for (var gsid in serversort){
        if (gids.indexOf(serversort[gsid].gid) != -1){
            var server = serversort[gsid];
            server.sendString('03ADDB{0}|{1}'.format(uid,gtype));
            log.info("03ADDB", server.gid, uid, gtype);
        }
    }
}

module.exports = {
    name: "hall",
    beans: [{
        id: "GoldService",
        func: GoldService,
        runupdate: 'init',
        scope: "singleton"
    }]
};