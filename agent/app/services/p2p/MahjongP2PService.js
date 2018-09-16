var log = require('pomelo-logger').getLogger("hall", "MahjongP2PService");
var pomelo = require('pomelo');
var async = require("async");
var sys = require("../StoreDatas").sys;

var GameConst = require("../../common/GameConst");
var Code = require("../../common/code");

var p2p = require("../StoreDatas").p2p;
var serversort = require("../StoreDatas").serversort;

var props = require("../StoreDatas").props;
var emojis = require("../StoreDatas").emojis;//emojis
var allexps = require("../StoreDatas").exps;
var vipConfig = require("../StoreDatas").vipConfig;
var Promise = require("bluebird");
var Tools = require('../../GameUtils/Tools');

var MahjongP2PService = function() {
	this.$id = "MahjongP2PService";
	this.$scope = "singleton";
	this.init();
};

var service = MahjongP2PService.prototype;
var gid = 103;

service.init = function(){

};

//创建房间
service.createRoom = function(me, session, body, next) {
	log.info('createRoom', session.uid, JSON.stringify(body));
	if (this.checkSysMaintenance(me, session, next)) return;
	var lockKey = 'mj_createroom_lock_' + session.uid, self = this;
    if (pomelo.app.get('lock').start(lockKey)) return me.error(session, next, 'actionFrequently', 'rel');
	self.roundsLimit(me, session, body, next, lockKey, function () {
		self._createRoom(me, session, body, next, lockKey);
	});
};

service._createRoom = function(me, session, body, next, lockKey) {
    body.type = parseInt(body.type) || 0;
    var gameid = gid;
    if(body.gameid) gameid = body.gameid;
    if(body.gid) gameid = body.gid;

    if(!body.type) return next(null, { rel: -1 });
    var room_gametype = body.type;

    var uid = session.uid;
    var self = this;
    delete body.__route__;
    if(body.gps) self.setUserGps(uid,body.gps);//设置gps

    var createGameRoom = function(body) {
        log.info('createGameRoom', JSON.stringify(body));
        var gsidtid = body.gid + '_' + body.rtype + "_" + body.ridx + '_' + body.tid;
        if (body.rel == 1) { //进入成功
            //记录开桌的房间类型
            var table = pomelo.app.get('gameserverManager').getTable(gsidtid);
            if(!!table) table.room_gametype = room_gametype;
            body.type = room_gametype;

            pomelo.app.get('randomAssignGameTable').addToUse(gsidtid, body.code, body.uid); //加入到已使用
            if(!p2p.mj.dk[body.uid]) p2p.mj.dk[body.uid] = [];
            if(p2p.mj.dk[body.uid].indexOf(body.code)!=-1){
                self.removeTableUser(gsidtid,body.uid);
                pomelo.app.get('lock').end(lockKey);
                return next(null,{rel:0,code:body.code,cards:body.cards});
            }
            self.startGame(gsidtid, session, body, next, lockKey);
        } else { //失败退卡
            var uid = body.uid;
            var cards = body.cards;
            var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
            self.refundCards(uid, cards, player, ',createGameRoom', 'mj', body.code, 3,body.gid);
            self.cleardaikai(uid,body.code);//清除代开信息
            delete p2p.mj.aa[body.code];//清楚开房AA信息
            pomelo.app.get('temporaryBadTable').addTempTable(gsidtid, body.code); //创建失败的桌子加入到临时坏桌子，10分钟后重新分配
            pomelo.app.get('lock').end(lockKey);
            me.operatorFailure(session, next, 'rel');

            pomelo.app.rpc.db.dbRemote.removeUserRoomByCode(null, body.code);
        }
    };

    //重连
    var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
    if (player) {
        var serverConfig = pomelo.app.get("gameserverManager").reconnectToGame(player);
        if (serverConfig) {
            pomelo.app.get('lock').end(lockKey);
            return next(null, { rel: -1 });
        }
    }
    if(parseInt(player.mid) > 0){
        pomelo.app.get('lock').end(lockKey);
        return next(null,{code:Code.FAIL,msg:'已参加比赛,不能创建房间!'});
    }
    var daikai = parseInt(body.daikai) || 0;
    if (daikai == 1) {
        pomelo.app.rpc.db.dbRemote.getClub(null,uid,function(club){
            log.info('daikai club', uid, JSON.stringify(club));
            if (club) {
                if(!p2p.mj.dk[uid]) p2p.mj.dk[uid] = [];
                if(p2p.mj.dk[uid]){
                    //清理已结束的代开房号
                    for (var i in p2p.mj.dk[uid]) if(!p2p.mj.code[p2p.mj.dk[uid][i]]) p2p.mj.dk[uid].splice(i,1);
                }
                if(p2p.mj.dk[uid].length < 5){
                    self.create(me,session,body,next,gameid,uid,createGameRoom,lockKey);
                }else{
                    pomelo.app.get('lock').end(lockKey);
                    return next(null, { rel: -1,msg:'代开房间已到上限!' })
                }
            }else{
                pomelo.app.get('lock').end(lockKey);
                return next(null, { rel: -1,msg:'不是俱乐部管理员不能代开房间!' });
            }
        })
    } else {
        self.create(me,session,body,next,gameid,uid,createGameRoom,lockKey);
    }
};

service._getTablePlayerNum = function(gid, body) {
	var num = 0, type = parseInt(body.type) || 0, stype = parseInt(body.stype) || 0;
	if ([20, 21, 24, 25].indexOf(type) != -1 || [215, 136, 171].indexOf(gid) != -1) {
		num = 4;
	} else if (type == 22 || [205, 211, 214, 137, 217].indexOf(gid) != -1) {
		num = 3;
	} else if (type == 100 || [1, 2, 3].indexOf(stype) != -1 || gid == 218) {
		num  = 5;
	} else if (type == 23){
		num = 2;
	} else if (gid == 216) {
		num = stype;
	}
	return num;
};
service.create = function(me, session, body, next, gameid, uid,createGameRoom,lockKey){
	log.info('create', gameid, uid, JSON.stringify(body));
	var player = pomelo.app.get('usermanager').getOnlineUserSort(uid),self = this;
	var s = pomelo.app.get('randomAssignGameTable').randTable(gameid); //随机
	if (s && s.gsid && s.code) {
		var cpid = parseInt(body.cpid) || 0;var clubid = parseInt(body.clubid) || 0;
		if(clubid > 0) {
			body.isaa = 0;body.daikai = 0;
			if ("code" in body && body.code  == 0) {
                if (!p2p.mj.quickroom) p2p.mj.quickroom = {};
                var gsidtid = s.gsid+'_'+s.tid;
                if (!p2p.mj.quickroom[clubid]) p2p.mj.quickroom[clubid] = {};
                var tablenum = self._getTablePlayerNum(gameid, body);
                p2p.mj.quickroom[clubid][gsidtid] = {code:s.code, num:tablenum, state:0};
			}
		}
		var daikai = parseInt(body.daikai) || 0;
		if(daikai == 1){
			if(!p2p.mj.dk[uid]) p2p.mj.dk[uid] = [];
			p2p.mj.dk[uid].push(s.code);
		}
		var gsidtid = s.gsid + '_' + s.tid;
		var server = pomelo.app.get('gameserverManager').getServerByGSID(s.gsid);
		if([201,205,211,214,216].indexOf(gameid) != -1){
			body.rounds = parseInt(body.rounds) || 6;
			var num = parseInt(body.rounds/6) || 0;
		}else if([123,218].indexOf(gameid) != -1) {
            body.rounds = parseInt(body.rounds) || 8;
            if ([8, 16].indexOf(body.rounds) != -1) {
                var num = parseInt(body.rounds / 8) || 0;
            } else {
                var num = parseInt((body.rounds - 16) / 8) || 0;
            }
        }else if([217].indexOf(gameid) !=-1) {
            body.rounds = body.rounds == 8 ? 8 : 16;
            var num = (body.rounds == 8) ? 1 : 2;
		}else if ([138,171].indexOf(gameid) !=-1){
			if([1,8].indexOf(body.rounds) == -1) body.rounds = 8;
			var num = 1;
		}else{
			body.rounds = parseInt(body.rounds) || 8;
			var num = parseInt(body.rounds/8) || 0;
		}
		if (!server) {
			log.error('icetea', s.gsid, '服务器不存在!');
			//pomelo.app.get('randomAssignGameTable').addToNotUse(gsidtid, s.code); //回收到未使用
			pomelo.app.get('lock').end(lockKey);
			return me.error(session, next, 'sysMaintenance', 'rel');
		}
		if (!!server && !!player && num) {
			if (player.room_card && player.room_card < num && clubid == 0) {
				log.error('icetea', player.uid, player.room_card, '用户卡数量不足!');
				pomelo.app.get('randomAssignGameTable').addToNotUse(gsidtid, s.code); //回收到未使用
				pomelo.app.get('lock').end(lockKey);
				return me.error(session, next, 'cardNotEnough', 'rel');
			}
			var isaa = parseInt(body.isaa) || 0;
			if(isaa == 0){
				if([205,211,214,217,138].indexOf(gameid) != -1) num = num * 3;
				else if([210].indexOf(gameid) != -1 && body.wft == 1) num = num*8;
				else num = num * 4;
			}
			//if([211,205].indexOf(gameid) != -1) num = 0;
			//扣除身上的房间卡
			if(clubid > 0){
				pomelo.app.get('cache').getClubMember(uid,clubid).then(function(clubmember){
					if(!clubmember){
						pomelo.app.get('lock').end(lockKey);
						return next(null,{rel:Code.FAIL,msg:'不是俱乐部成员!'});
					}
					if (!p2p.mj.club) p2p.mj.club = {};
					p2p.mj.club[s.code] = {cpid:cpid,clubid:clubid};
					pomelo.app.rpc.db.dbRemote.addCPStones(null,clubid,cpid,3,-num,uid, s.code,function(result){
						if(result.ret > -1){
							self.roomcreate(me,session,next,gsidtid,player,num,body,s,lockKey,createGameRoom,server);
						}else{
							pomelo.app.get('randomAssignGameTable').addToNotUse(gsidtid, s.code); //回收到未使用
							pomelo.app.get('lock').end(lockKey);
							return next(null,{code:Code.FAIL,msg:'包厢元宝不足,创建失败!'});
						}
					})
				})
			}else{
				self.roomcreate(me,session,next,gsidtid,player,num,body,s,lockKey,createGameRoom,server);
			}
		} else {
			pomelo.app.get('randomAssignGameTable').addToNotUse(gsidtid, s.code); //回收到未使用
			pomelo.app.get('lock').end(lockKey);
			me.operatorFailure(session, next, 'rel');
		}
	} else {
		pomelo.app.get('lock').end(lockKey);
		me.error(session, next, 'sysWait', 'rel');
	}
};
service.roomcreate = function(me,session,next,gsidtid,player,num,body,s,lockKey,createGameRoom,server){
	var cpid = parseInt(body.cpid) || 0;
	var gameid = gsidtid.split('_')[0];
	var uid = player.uid;
	var isaa = parseInt(body.isaa) || 0;
	var daikai = parseInt(body.daikai) || 0;
	var roomcard = num;
	var realnum = num;
	var clubid = parseInt(body.clubid) || 0;
	if(clubid > 0) num = 0;
	if(isaa == 1 && daikai == 1) num = 0;
	if(player) player.sendMsg(GameConst.pushCmd.openroom, { code: s.code });
	pomelo.app.rpc.db.dbRemote.addRoomCards(null, uid, -num, Code.GOLD.P2P_USE_ROOMCARD, 'use roomcard:-' + num, gameid, s.code, function(result){
		if ((result && result.nums > -1) || num == 0) {
			if(!p2p.mj.aa) p2p.mj.aa = {};
			p2p.mj.aa[s.code] = {isaa:isaa,card:roomcard};
			var meng = parseInt(body.meng) || 0;
			var checkIp = parseInt(body.checkIp) == 1 ? 1 : 0;
			if(!p2p.mj.checkIp) p2p.mj.checkIp = {};
			p2p.mj.checkIp[gsidtid] = checkIp;
			var checkGps = parseInt(body.checkGps) == 1 ? 1 : 0;
			if(!p2p.mj.checkGps) p2p.mj.checkGps = {};
			p2p.mj.checkGps[gsidtid] = checkGps;
			var baidad = parseInt(body.baidad) || 0;
			var bdwcount = parseInt(body.bdwcount) || 0;//干瞪眼 王最多出几张
			var wft = parseInt(body.wft) || 0;//干瞪眼 王压2
			var fd = parseInt(body.fd) || 0;//干瞪眼 封顶倍数
			var wdc = parseInt(body.wdc) || 0;//干瞪眼 王单出
			var choujiang = parseInt(body.choujiang) || 0;
			var dt = parseInt(body.dt) || 0;
			var sw = parseInt(body.sw) || 0;
			var luckycard = parseInt(body.luckycard) || 0;
			var black3 = parseInt(body.black3) || 0;
			var bomb = parseInt(body.bomb) || 0;
			var red10 = parseInt(body.red10) || 0;
			var red10score = parseInt(body.red10score) || 0;
			var hua = parseInt(body.hua) || 0;
			var obj = {
				rounds: body.rounds, type: body.type,stype:parseInt(body.stype) || 0, mingkou:parseInt(body.mingkou)||0,
				dhu:parseInt(body.dhu)||0, daifg:parseInt(body.daifg) || 0,
				uid: uid, code: s.code, tid: s.tid, gsid: s.gsid, cards: realnum,meng: meng,checkIp: checkIp,
				bdwcount:bdwcount,wft:wft,fd:fd,wdc:wdc,baidad:baidad,choujiang:choujiang,checkGps:checkGps,
				dt:dt,sw:sw,daikai:daikai,isaa:isaa,ting:parseInt(body.ting) || 0,cpid:cpid,clubid:clubid,
                luckycard:luckycard, black3:black3, bomb:bomb, red10:red10, red10score:red10score, hua:hua
			};
			if(gameid == 210 && obj.stype == 2) obj.type += 3;
			if(gameid == 210 && wft == 1) obj.type += 7;
			pomelo.app.rpc.db.dbRemote.createUserRooms(null, obj, result.lid, function(lid) {
				if(num > 0){
					player.room_card = result.nums;
					player.card_use = player.card_use + num;
					player.sendMsg(GameConst.pushCmd.roomCardsChange, { room_card: player.room_card, cards: -num ,card_use:player.card_use});
				}
				var gobj = { rounds: body.rounds, type: body.type,stype:parseInt(body.stype) || 0,mingkou:parseInt(body.mingkou)||0,
					dhu:parseInt(body.dhu)||0,daifg:parseInt(body.daifg) || 0,ting:parseInt(body.ting) || 0,
					meng: meng,checkIp:checkIp,bdwcount:bdwcount,wft:wft,fd:fd,wdc:wdc,baidad:baidad,dt:dt,sw:sw,daikai:daikai,cpid:cpid,
                    luckycard:luckycard, black3:black3, bomb:bomb, red10:red10, red10score:red10score, hua:hua}; //, stype: body.stype, times: body.times
				server.sendString('03CRET{0}|{1}|{2}|{3}|{4}|{5}|{6}|{7}'.format(pomelo.app.get('gameserverManager').getTick(createGameRoom), s.tid, uid, s.code, roomcard, lid,isaa, JSON.stringify(gobj)));
			});
			pomelo.app.get('cache').removeUser(uid);
		} else {
			pomelo.app.get('randomAssignGameTable').addToNotUse(gsidtid, s.code); //回收到未使用
			pomelo.app.get('lock').end(lockKey);
			log.error('icetea', player.uid, player.room_card, '用户卡数量不足2!');
			me.error(session, next, 'cardNotEnough', 'rel');
		}
	});
};

service.checkSysMaintenance = function(me, session, next) {
	var isTest = [10017, 10029, 10030].indexOf(parseInt(session.uid)) != -1;
	if (isTest) return false;

	if (sys.SYS_MAINTENANCE) {
		me.error(session, next, 'sysMaintenance', 'rel');
	}
	return sys.SYS_MAINTENANCE;
};
//进入房间
service.enterGameByRoom = function(me, session, body, next) {
	log.info('enterGameByRoom', session.uid, JSON.stringify(body));
	var uid = session.uid;var self = this;
	var clubid = parseInt(body.clubid) || 0;
	if(body.gps) this.setUserGps(uid,body.gps);//设置gps
	var lockKey = 'mj_enterroom_lock_' + uid;
	if (pomelo.app.get('lock').start(lockKey)) return me.error(session, next, 'actionFrequently', 'rel');

	//重连
	var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
	if (player) {
		var serverConfig = pomelo.app.get("gameserverManager").reconnectToGame(player);
		if (serverConfig) {
			pomelo.app.get('lock').end(lockKey);
			return next(null, { rel: -1 });
		}
	}

	if(parseInt(player.mid) > 0){
		pomelo.app.get('lock').end(lockKey);
		return next(null,{code:Code.FAIL,msg:'已参加比赛,不能进入房间!'});
	}

	if (clubid > 0 && body.code == 0) {
		var code = 0;
        if (!p2p.mj.quickroom) p2p.mj.quickroom = {};
        if (p2p.mj.quickroom[clubid]) {
            for (var i in p2p.mj.quickroom[clubid]) {
                if (p2p.mj.use.indexOf(i) == -1) { delete p2p.mj.quickroom[clubid][i]; continue; }
                var state = parseInt(p2p.mj.quickroom[clubid][i].state) || 0;
                if (state == 1) continue;
                var num = parseInt(p2p.mj.quickroom[clubid][i].num) || 0;
                var users = p2p.mj.gsidtid[i] ? p2p.mj.gsidtid[i] : [];
                var userCount = parseInt(users.length) || 0;
                if (num > userCount) {
                    code = p2p.mj.quickroom[clubid][i].code;
                    break;
                }
            }
        }
        if (code > 99999) {
			self.roundsLimit(me, session, body, next, lockKey,function(){
				self._enterGameByRoom(me, session, { code: code }, next, lockKey);
			});    
        } else {
				pomelo.app.get('cache').getClubMember(session.uid,clubid).done(function(clubmember){
					if(clubmember){
						pomelo.app.rpc.db.dbRemote.getClubById(null, clubmember.puid, function(club){
							var gameConfig = club.game;
							if (club.gameSwitch == 1 && gameConfig.length > 0) { //开房配置打开并且已配置
								var config = gameConfig.replace(/\\/gm, '');
								log.info("quickconfig", config);
								var data = JSON.parse(config);
								data.code = 0;
								self.roundsLimit(me, session, body, next, lockKey, function () {
									self._createRoom(me, session, data, next, lockKey);
								});
							} else {
								pomelo.app.get('lock').end(lockKey);
								return next(null,{code:Code.FAIL,msg:'无法快速开始，请手动创建房间'});
							}
						});
					}else{
						pomelo.app.get('lock').end(lockKey);
						return next(null,{code:Code.FAIL,msg:'未加入俱乐部,无法进入房间!'});

					}
				});
        }
	} else {
		self.roundsLimit(me, session, body, next, lockKey, function() {
			self._enterGameByRoom(me, session, body, next, lockKey);
		});
	}

};

service._enterGameByRoom = function(me, session, body, next, lockKey) {
	var self = this;
    var player = pomelo.app.get('usermanager').getOnlineUserSort(session.uid);
    var gsidtid = pomelo.app.get('randomAssignGameTable').getUseTableByCode(body.code);

    if (!gsidtid) {
        pomelo.app.get('lock').end(lockKey);
        return me.error(session, next, 'roomNotExist', 'rel');
    }
    var user = p2p.mj.gsidtid[gsidtid];
    var checkIp = p2p.mj.checkIp && p2p.mj.checkIp[gsidtid] ? p2p.mj.checkIp[gsidtid] : null;
    var checkGps = p2p.mj.checkGps && p2p.mj.checkGps[gsidtid] ? p2p.mj.checkGps[gsidtid] : null;
    if(user){
        if(checkIp){
            var players = {};
            for (var i=0;i<user.length;i++){
                players[user[i]] = pomelo.app.get('usermanager').getOnlineUserSort(user[i]);
            }
            for (var tuid in players){
                if(players[tuid].login_ip == player.login_ip && tuid != player.uid){
                    pomelo.app.get('lock').end(lockKey);
                    return me.error(session, next, 'sameIp', 'rel');
                    break;
                }
            }
        }
        //if(checkGps){
        //	for (var uid in players){
        //		var d = this.checkGps(players[uid].lang,players[uid].lat,player.lang,player.lat);
        //		if(d <= 20 && uid != player.uid) {
        //			pomelo.app.get('lock').end(lockKey);
        //			return me.error(session, next, 'gps', 'rel');
        //			break;
        //		}
        //	}
        //}
    }

    //增加房间类型返回
    var table = pomelo.app.get('gameserverManager').getTable(gsidtid);
    if(!table){
        pomelo.app.get('lock').end(lockKey);
        return me.error(session, next, 'roomNotExist', 'rel');
    }

    var g = gsidtid.split('_');
    var obj = { gid: g[0], rtype: g[1], ridx: g[2], tid: g[3], code: body.code, type: table.room_gametype };
    var aaData = p2p.mj.aa && p2p.mj.aa[body.code] ? p2p.mj.aa[body.code] : null;
    if (aaData && aaData.isaa == 1) {
        var num = parseInt(aaData.card) || 0;
        if(num > 0){
            pomelo.app.rpc.db.dbRemote.addRoomCards(null, session.uid, -num, Code.GOLD.P2P_USE_ROOMCARD, 'aa,use roomcard:-' + num, g[0], body.code, function(result){
                pomelo.app.get('cache').removeUser(session.uid);
                if (result && result.nums > -1) {
                    player.room_card = result.nums;
                    player.card_use = player.card_use + num;
                    player.sendMsg(GameConst.pushCmd.roomCardsChange, { room_card: player.room_card, cards: -num ,card_use:player.card_use});
                    // self.updateVip(uid);
                    self.startGame(gsidtid, session, obj, next, lockKey);
                }else{
                    pomelo.app.get('lock').end(lockKey);
                    return me.error(session, next, 'cardNotEnough', 'rel');
                }
            });
        }else{
            self.startGame(gsidtid, session, obj, next, lockKey);
        }
    } else {
        var clubid = !!p2p.mj.club && !!p2p.mj.club[body.code] && !!p2p.mj.club[body.code].clubid ? p2p.mj.club[body.code].clubid : 0;
        if (clubid > 0) {
            pomelo.app.get('cache').getClubMember(session.uid,clubid).done(function(clubmember){
                if(clubmember){
                    self.startGame(gsidtid, session, obj, next, lockKey);
                }else{
                    pomelo.app.get('lock').end(lockKey);
                    return next(null,{code:Code.FAIL,msg:'未加入俱乐部,无法进入房间!'});

                }
            })
        } else {
            self.startGame(gsidtid, session, obj, next, lockKey);
        }

    }
};
//游戏结束
service.endGame = function(body){
	log.info('body->endGame' + JSON.stringify(body));
	var gsid = body.gid + '_' + body.rtype + "_" + body.ridx;
	var gsidtid = gsid + '_' + body.tid;
    var clubid = !!p2p.mj.club && !!p2p.mj.club[body.code] && !!p2p.mj.club[body.code].clubid ? p2p.mj.club[body.code].clubid: 0;
    var cpid = !!p2p.mj.club && !!p2p.mj.club[body.code] && !!p2p.mj.club[body.code].cpid ? p2p.mj.club[body.code].cpid: 0;
	if (body.rel == 1) {
		var uid = body.uid;
		var cards = body.cards;
		var aaData = p2p.mj.aa ? p2p.mj.aa[body.code] : null;
		if (aaData && aaData.isaa) {
			var istuikauid = [];
			for (var i in body.uids) {
				if(istuikauid.indexOf(body.uids[i]) == -1){
					var player = pomelo.app.get('usermanager').getOnlineUserSort(body.uids[i]);
					this.refundCards(body.uids[i], cards, player, 'aa,endGame', 'mj', body.code, 2,body.gid);//结束退卡
					istuikauid.push(body.uids[i]);
				}
			}
			pomelo.app.rpc.db.dbRemote.removeUserRooms(null, body.code, 2);
		} else {
			if(clubid > 0){
				pomelo.app.rpc.db.dbRemote.addCPStones(null,clubid,cpid,4,cards,uid,body.code,function(){});
				pomelo.app.rpc.db.dbRemote.removeUserRooms(null,body. code, 2);
			}else{
				var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
				this.refundCards(uid, cards, player, ',endGame', 'mj', body.code, 2,body.gid); //结束退卡
			}
		}
	} else {
		if(body.isfajiang && body.isfajiang > 0) this.addticket(body.isfajiang, body.uids,body.uid);
		// this.updateVip(body.uid);
		pomelo.app.rpc.db.dbRemote.removeUserRooms(null, body.code, 1); //结束不退卡
	}
	this.cleardaikai(body.uid,body.code);//清除代开信息
	delete p2p.mj.aa[body.code];//清楚开房AA信息
	pomelo.app.get('randomAssignGameTable').deleteByUse(gsidtid, body.code, sys['SYS_MAINTENANCE_' + gsid]); //删除已经使用
    if (!p2p.mj.quickroom) p2p.mj.quickroom = {};
    if(clubid > 0 && p2p.mj.quickroom[clubid] && p2p.mj.quickroom[clubid][gsidtid]) delete p2p.mj.quickroom[clubid][gsidtid];

	var server = pomelo.app.get('gameserverManager').getServerByGSID(gsid);
	if (!!server) {
		var table = server.getTable(body.tid);
		if (!!table) table.dispose();
	}
};
//发放礼券
service.addticket = function(type, uids, creater) {
	if (!sys['SEND_TICKET']) { log.error('礼券数量未配置！'); return; }
	var num = sys.SEND_TICKET;
	var max = type * num;
	var len = uids.length;
	var o = parseInt(max * 0.2);
	max = max - o;
	max = max - len*type;
	var ticket = [];
	for(var i=0;i<len-1;i++){
		var card = parseInt(Math.random()*max)
		max = max - card;
		card = card + type;
		ticket.push(card);
	}
	max = max + type;
	ticket.push(max);
	ticket = this.shuffle(ticket);
	for(var key in uids){
		var uid = uids[key];
		var cards = ticket[key];
		if(uid == creater) cards = cards + o;
		this.addUserTicket(uid,cards);
	}
};
//打乱数组顺序
service.shuffle = function(array){
	var m = array.length, t, i;
	while (m) {
		i = Math.floor(Math.random() * m--);
		t = array[m];
		array[m] = array[i];
		array[i] = t;
	}
	return array;
};
//加礼券
service.addUserTicket = function(uid, tickets){
	//console.log(uid,tickets);
	var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
	Promise.props({
		user:pomelo.app.get('cache').getUser(uid),
		userProps:pomelo.app.get('cache').getUserProps(uid)
	}).then(function(r){
		var u = r.user,userProps = r.userProps,isjb = 0;
		var unix = Math.round(+new Date() / 1000);
		if(u && u.use_prop > 0 && userProps){
			for(var i in userProps){
				if(userProps[i].pid == u.use_prop){
					if(userProps[i].pid == u.use_prop){
						var prop = props[u.use_prop];
						if(prop) {
							// 判断是否拥有该道具,是否过期
							if ((userProps[i].expire >= unix || userProps[i].expire == 0) && u.vip_level >= prop.vip_level && u.level >= prop.level) {
								//道具礼券加成
								tickets = parseInt(tickets * prop.tickets_scale);
								//道具礼券暴击
								if (Math.floor(Math.random() * 100) < prop.tickets_crit) {
									isjb++;
									tickets = tickets * 2;
								}
								//道具礼券超级暴击
								if (Math.floor(Math.random() * 100) < prop.super_crit) {
									isjb++;
									tickets = tickets * 2;
								}
								break;
							}
						}
					}
				}
			}
		}
		//console.log(uid,tickets);
		pomelo.app.rpc.db.dbRemote.addTickets(null, uid, tickets, Code.TICKET.P2P_USER_TICKET, 'add ticket:' + tickets, gid, function(r) {
			if (r && r.nums > -1 && player) {
				player.ticket = r.nums;
				//log.info('player->' + JSON.stringify(player));
				player.sendMsg(GameConst.pushCmd.ticketChange, { ticket: player.ticket, num: tickets ,isjb:isjb});
			}
		});
	})
};
//开始游戏
service.startGame = function(gsidtid, session, body, next, lockKey){
	log.info('startGame', gsidtid, session.uid, JSON.stringify(body));
	var uid = session.uid;
	var gameid = gsidtid.split("_")[0];
	var msg = { gid:gameid, rtype:body.rtype, ridx:body.ridx, quick:0, tableid:body.tid};
	var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
	if(player) player.sendMsg(GameConst.pushCmd.enterroom, { gid:msg.gid,code:body.code })
	pomelo.app.get("gameserverManager").enterToGame(player, msg, player.locale || 'zh_CN', function(result) {
		log.info('enterToGame', JSON.stringify(msg), JSON.stringify(result));
		if (player) result.cards = player.room_card;
		if (result.rel == 0) {
			pomelo.app.get('randomAssignGameTable').addUserToTable(gsidtid, uid);
			if (!result.gid) result.gid = gameid;
			if (!result.rtype) result.rtype = body.rtype;
			if (!result.ridx) result.ridx = body.ridx;
			if (!result.tid) result.tid = body.tid;
			if (!result.room) result.room = body.code;
			result.type = body.type;
			var code = !!p2p.mj.codesort && !!p2p.mj.codesort[gsidtid] ? p2p.mj.codesort[gsidtid] : 0;
			result.cpid = code > 0 && !!p2p.mj.club && !!p2p.mj.club[code] && !!p2p.mj.club[code].cpid ? p2p.mj.club[code].cpid : 0;
			result.clubid = code > 0 && !!p2p.mj.club && !!p2p.mj.club[code] && !!p2p.mj.club[code].clubid ? p2p.mj.club[code].clubid : 0;
			pomelo.app.get('lock').end(lockKey);
			return next(null, result);
		} else {
			pomelo.app.get('lock').end(lockKey);
			return next(null, result);
		}
	});
};
//退卡
service.refundCards = function(uid, cards, player, info, game, code, state,gameid) {
	var self = this;
	info = info || '';
	pomelo.app.rpc.db.dbRemote.addRoomCards(null, uid, cards, Code.GOLD.P2P_REFUND_ROOMCARD, 'refund roomcard:' + cards + info, gameid, code, function(r) {
		if (r && r.nums > -1 && player) {
			player.room_card = r.nums;
			player.card_use = player.card_use - cards;
			player.sendMsg(GameConst.pushCmd.roomCardsChange, { room_card: player.room_card, cards: cards ,card_use:player.card_use});
			// self.updateVip(uid);
		}
		pomelo.app.rpc.db.dbRemote.removeUserRooms(null, code, state);
		pomelo.app.get('cache').removeUser(uid);
	});
};
//注册桌子
service.registerTables = function(gsid, tables) { pomelo.app.get('randomAssignGameTable').registerTables(gsid, tables); };
//注销桌子
service.removeTable = function(gsid, table) { pomelo.app.get('randomAssignGameTable').removeTable(gsid, table); };
//清理桌子用户
service.removeTableUser = function(gsidtid, uid) { pomelo.app.get('randomAssignGameTable').removeTableUser(gsidtid, uid); };
//清理房间
service.removeRooms = function(gsid) {
	log.info('icetea removeRooms', gsid);
	pomelo.app.rpc.db.dbRemote.removeRooms(null, gsid);
};
//检测是否重连
service.checkReconnect = function(serverData, uid) {
	var gsidtid = serverData.gid + "_" + serverData.rtype + "_" + serverData.ridx + "_" + serverData.tableid;
	var table = pomelo.app.get('gameserverManager').getTable(gsidtid );
	if(!!table) serverData.type = table.room_gametype;

	return pomelo.app.get('randomAssignGameTable').checkReconnect(gsidtid, uid);
};
//gsid正在使用的桌子数量
service.getUseTableCount = function(gsid) { return pomelo.app.get('randomAssignGameTable').getUseTableCount(gsid); };
//部分维护清理
service.clearMaintenanceServer = function(gsid) {
	var server = serversort[gsid];
	if (server) {
		server.sendString('KSWH');
	}
	return pomelo.app.get('randomAssignGameTable').clearMaintenanceServer(gsid); 
};
//gps获取
service.setUserGps = function(uid,gps){
	var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
	if(gps && player){
		player.gps = gps;
		var tmpgps = gps.split('_');
		player.lang = tmpgps[0] ? tmpgps[0] : '0.0';
		player.lat = tmpgps[1] ? tmpgps[1] : '0.0';
	}
};
//gps检测
service.checkGps = function(long1,lat1,long2,lat2){
	var R = 6378137;
	lat1 = lat1 * Math.PI / 180.0;
	lat2 = lat2 * Math.PI / 180.0;
	var a = lat1 - lat2;
	var b = (long1 - long2) * Math.PI / 180.0;
	var sa2 = Math.sin(a / 2.0);
	var sb2 = Math.sin(b / 2.0);
	var d = 2 * R * Math.asin(Math.sqrt(sa2 * sa2 + Math.cos(lat1) * Math.cos(lat2) * sb2 * sb2));
	return d;
};
//每天参与次数限制
service.roundsLimit = function (me, session, body, next, lockKey, cb){
	var ldate = Tools.getDateKey(Math.round(+new Date() / 1000), "YYYYMMDD");
	pomelo.app.rpc.db.dbRemote.getUserLiushui(null, ldate, session.uid, function (liushui) {
		if (liushui && liushui.takeparts >= 200) {
			pomelo.app.get('lock').end(lockKey);
			return next(null, { code: Code.FAIL, msg: '今天参与次数已达上限，请明天再玩哦!' });
		}
		if (cb) cb();
	});
};
//获取玩家gps
service.getGps = function(me, session, body, next){
	var uids = body.uids;
	var gps = {};
	if(uids){
		for (var i in uids){
			var player = pomelo.app.get('usermanager').getOnlineUserSort(uids[i]);
			if(player){
				gps[uids[i]] = player.gps ? player.gps : '';
			}else{
				gps[uids[i]] = '';
			}
		}
	}
	return next(null, { code: Code.OK,gps: gps });
};
service.cleardaikai = function(uid,code){
	if(p2p.mj.dk[uid]){//清理代开使用的桌子
		while(p2p.mj.dk[uid].indexOf(code) != -1) {
			var index = p2p.mj.dk[uid].indexOf(code);
			if (index != -1) p2p.mj.dk[uid].splice(index, 1);
		}
	}
};
//gps获取
service.setGps = function(me, session, body, next){
	var player = pomelo.app.get('usermanager').getOnlineUserSort(session.uid);
	var gps = body.gps ? body.gps : '0_0_0_0_0';
	if(gps && player){
		player.gps = gps;
		var tmpgps = gps.split('_');
		player.lang = tmpgps[0] ? tmpgps[0] : '0.0';
		player.lat = tmpgps[1] ? tmpgps[1] : '0.0';
	}
	return next(null,{code:Code.OK});
};
service.kfjs = function(me, session, body, next){
	var self = this;
	var kfjs = function(body){
		console.log('kfjs -----> ', JSON.stringify(body));
		if (body.rel == 1) {
			self.cleardaikai(body.uid,body.code);//清除代开信息
			delete p2p.mj.aa[body.code];//清楚开房AA信息
			var gsidtid = body.gid + '_' + body.rtype + "_" + body.ridx + '_' + body.tid;
			var gsid = body.gid + '_' + body.rtype + "_" + body.ridx;
			pomelo.app.get('randomAssignGameTable').deleteByUse(gsidtid, body.code, sys['SYS_MAINTENANCE_' + gsid]); //删除已解散
			return next(null,{code:Code.OK});
		}
		return next(null,{code:Code.FAIL,msg:'游戏已开始,解散失败!'});
	};
	if(p2p.mj.dk[session.uid]){
		if (p2p.mj.dk[session.uid].indexOf(body.code) == -1) {
			return me.error(session, next, 'roomdissolved', 'rel');
		} else {
			var gsidtid = p2p.mj.code[body.code];
			if (!gsidtid) return;
			var table = gsidtid.split('_');
			var gsid = table[0]+'_'+table[1]+'_'+table[2];
			var server = serversort[gsid];
			if (server) {
				server.sendString('01KFJS'+pomelo.app.get('gameserverManager').getTick(kfjs)+'|'+session.uid+'|'+table[3]);
			} else {
				return next(null,{code:Code.FAIL,msg:'房间不存在,请重试!'});
			}
		}
	} else {
		return me.error(session, next, 'roomdissolved', 'rel');
	}
};

//更新vip数据
service.updateVip = function(uid){
	var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
	pomelo.app.get('cache').getUser(uid).then(function(user){
		var c = { vip_level: 0, money_exps: 0, pid: 0, days: 0, rounds: 0 };
		var vip_level = user.vip_level;
		if(vip_level >= 10) return false;
		var vip_card = user.vip_card;
		var currentConfig = vip_level == 0 ? c : vipConfig[vip_level];
		var nextConfig = vipConfig[vip_level+1];
		var card_exps = nextConfig.money_exps - currentConfig.money_exps;
		if(vip_card >= card_exps){
			//升级vip
			pomelo.app.rpc.db.dbRemote.updateVip(null,uid,vip_level+1,card_exps,nextConfig.days,function(){
				pomelo.app.get('cache').removeUser(uid);
				currentConfig = nextConfig;
				nnextConfig = vip_level+2 <= 10 ? vipConfig[vip_level+2] : c;
				//console.log(nextConfig);
				var need_cards = nnextConfig.money_exps > currentConfig.money_exps ? nnextConfig.money_exps - currentConfig.money_exps - (vip_card - card_exps) : 0;
				//console.log({vip_level:vip_level+1,pid:pid,day:timelen,need_cards:need_cards});
				if(player) {
					player.sendMsg(GameConst.pushCmd.vipLevel,{vip_level:vip_level+1,pid:0,day:0,need_pay:need_cards});
					player.sendMsg(GameConst.pushCmd.vip_rounds,{vip_rounds:0});
					player.vip_rounds = 0;
				}
			});
			
			//赠送礼品
			async.parallel([
				function(cb){
						var pid = nextConfig.pid,timelen = 0;
						var prop = props[pid];
						if(prop){
							timelen = prop.timelen;
							pomelo.app.rpc.db.dbRemote.getUserProp(null ,uid, pid, function (r) {
								if (!r) pomelo.app.rpc.db.dbRemote.addUserProp(null, uid, pid, 0, 0, function (ret) {
									if(ret[0].ret == 0){
										pomelo.app.get('cache').removeUserProp(uid);
										cb(null, {pid:pid, timelen:timelen});
									}
								});
								else cb(null, {pid:0, timelen:0});
							});
						}else{
							cb(null, {pid:0, timelen:0});
						}
				},
				function(cb) {
						//vip聊天边框
						var chat_frame = nextConfig.chat_frame, chat_timelen = 0;
						var chat_prop = props[chat_frame];
						if(chat_prop){
						  chat_timelen = chat_prop.timelen;
						  pomelo.app.rpc.db.dbRemote.getUserProp(null ,uid, chat_frame,function (r) {
						      if (!r) pomelo.app.rpc.db.dbRemote.addUserProp(null, uid, chat_frame, 0, 0, function (ret) {
						          if(ret[0].ret == 0){
						              pomelo.app.get('cache').removeUserProp(uid);
									  cb(null, {chat:chat_frame, chat_timelen:chat_timelen});
						          }
						      }); 
									else {
										cb(null, {chat:0, chat_timelen:0});
									}
						  });
						}else{
							cb(null, {chat:0, chat_timelen:0});
						}
				},
				function(cb) {
					//表情
					var eid = nextConfig.emojis, emoji = emojis[eid];
					var state = 1, buy_state = 1, gstate = 1, gtimelen = 0;
					if(emoji){
					      pomelo.app.rpc.db.dbRemote.getUserEmoji(null ,uid, eid,function (r) {
					          if (!r) pomelo.app.rpc.db.dbRemote.addUserEmoji(null, uid, eid, state, buy_state, gstate, gtimelen, function () {
										pomelo.app.get('cache').removeUserEmojis(uid);
										cb(null, {eid:eid});
					          });
							else {
								 cb(null, {eid:0});
							}
					      });
					} else {
			 			 cb(null, {eid:0});
					}
				}
			], function(err, results){
				if (results instanceof Array && player) {
					var mascot = results[0], frame = results[1], eids = results[2];
					var obj = {type:1, level:vip_level+1, pid:mascot.pid, timelen:mascot.timelen, chat:frame.chat, chat_timelen:frame.chat_timelen, eid:eids.eid};
					player.sendMsg(GameConst.pushCmd.prop, obj);
				} else {
					 console.error(uid+"升级赠送礼物失败:", err);
				}
			});
			
		}else{
			var need_cards = card_exps - vip_card;
			if(player) player.sendMsg(GameConst.pushCmd.vipLevel,{vip_level:vip_level,pid:0,day:0,need_pay:need_cards});
		}
	})
};

//用户家经验
service.addUserExps = function(uid,exps){
	var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
	return Promise.props({
		user: pomelo.app.get('cache').getUser(uid),
		levels: pomelo.app.get('cache').getGameLevel(),
		userProps: pomelo.app.get('cache').getUserProps(uid)
	}).then(function(r){
		var u = r.user,levels = r.levels,userProps = r.userProps;
		var unix = Math.round(+new Date() / 1000);
		if(!u || typeof(u.level) === 'undefined' || typeof(u.experience) === 'undefined') return false;
		if(u && u.use_prop > 0 && userProps){
			for(var i in userProps){
				if(userProps[i].pid == u.use_prop){
					var prop = props[u.use_prop];
					if(prop){
						if((userProps[i].expire >= unix || userProps[i].expire == 0) && u.vip_level >= prop.vip_level && u.level >= prop.level){
							//道具经验加成
							exps = parseInt(exps * prop.exps_scale);;
							//道具经验暴击
							if(Math.floor(Math.random()*100) < prop.exps_crit) exps = exps * 2;
							//道具经验超级暴击
							if(Math.floor(Math.random()*100) < prop.super_crit) exps = exps * 2;
							break;
						}
					}
				}
			}
		}
		var all_exps = u.experience + exps;
		var level = u.level;
		var timelen = 0,pid = 0;
		for(var key in levels){
			if(all_exps >= levels[key].exps && level <= levels[key].level){
				level = levels[key].level + 1;
				
				//记录升级
				pomelo.app.rpc.db.dbRemote.logUserLevel(null, uid, level);

				// 升级赠送道具
				pid = levels[level].pid
				if(pid > 0) {
					if(props[pid]){
						timelen = props[pid].timelen;
					}
					pomelo.app.rpc.db.dbRemote.getUserProp(null ,uid, pid,function (prop) {
						if (!prop) pomelo.app.rpc.db.dbRemote.addUserProp(null, uid, pid, 0, 0, function (ret) {
							if(ret[0].ret == 0){
								pomelo.app.get('cache').removeUserProp(uid);
								if(player) player.sendMsg(GameConst.pushCmd.prop,{type:2,level:level,pid:pid,timelen:timelen, chat:0, chat_timelen:0, eid:0});
							}

						})
					});
				}
				break;
			}
		}
		if(allexps[uid]){
			allexps[uid] = allexps[uid] + exps;
		}else{
			allexps[uid] = exps;
		}
		//console.log('level->'+level+'|pid->'+pid+'|timelen->'+timelen);
		//console.log('addexps--->'+uid+'----'+exps)
		pomelo.app.rpc.db.dbRemote.updateUser(null, uid, level, exps, function() {
			pomelo.app.get('cache').removeUser(uid);
			if(player) {
				var next = levels[level];
				var current = level > 0 ? levels[level-1] : {level:0,exps:0,pid:0};
				var config = {current:current,next:next};
				player.sendMsg(GameConst.pushCmd.level,{level:level,experience:all_exps,pid:0,timelen:0,config:config});
			}
		});
		return allexps[uid];
	});
};

//游戏心跳
service.heartbeat = function(me, session, body, next) {
	var player = pomelo.app.get('usermanager').getOnlineUserSort(session.uid);
	var flag = false;
	if (player && player.tableid) {
		var server = gsManager.getServerByGSID(player.gsid);
		if (server && server.sendString) {
			flag = server.sendString('02UBET' + session.uid);
		}
	}
	next(null, { code: flag ? Code.OK : Code.FAIL, time: body.time });
};

//进入房间邀请
service.enterRoomInvite = function(me, session, body, next) {
    log.info('enterRoomInvite', session.uid, JSON.stringify(body));
    var fromuid = session.uid; var self = this;
    var touid = body.uid, code = body.code, type = parseInt(body.type);
    var lockKey = 'mj_enterRoomInvite_lock_'+"_"+ code + fromuid +"_" + touid +"_"+type;
    if (pomelo.app.get('lock').start(lockKey)) return me.error(session, next, 'actionFrequently', 'rel');
    var fromplayer = pomelo.app.get('usermanager').getOnlineUserSort(fromuid);
    var toplayer = pomelo.app.get('usermanager').getOnlineUserSort(touid);
    if (fromplayer && toplayer) {
		if (type == 1) { //回应拒绝
            pomelo.app.get('lock').end(lockKey);
            return toplayer.sendMsg(GameConst.pushCmd.roomRefuse, {code:code, user:{uid:fromplayer.uid, nickname:fromplayer.nickname}});
		} else { //邀请
            var gsidtid = pomelo.app.get('randomAssignGameTable').getUseTableByCode(code);
            if (!gsidtid) {
                pomelo.app.get('lock').end(lockKey);
                return me.error(session, next, 'roomNotExist', 'rel');
            }
            var table = pomelo.app.get('gameserverManager').getTable(gsidtid);
            if(!table){
                pomelo.app.get('lock').end(lockKey);
                return me.error(session, next, 'roomNotExist', 'rel');
            }
            pomelo.app.rpc.db.dbRemote.getRuningRoomByCode(null, code, function(room){
            	if (room){
                    var user = p2p.mj.gsidtid[gsidtid];
                    pomelo.app.get('lock').end(lockKey);
                    toplayer.sendMsg(GameConst.pushCmd.roomInvite, {invitor:{uid:fromplayer.uid, nickname:fromplayer.nickname}, room:room, roomUsers:user});
                    return me.error(session, next, 'inviteAlreadySend', 'rel');
				} else {
                    pomelo.app.get('lock').end(lockKey);
                    return me.error(session, next, 'roomNotExist', 'rel');
				}
			});
		}
    } else {
        pomelo.app.get('lock').end(lockKey);
        return me.error(session, next, 'userOffline', 'rel');
	}

}

module.exports = {
	name: "hall",
	beans: [{
		id: "MahjongP2PService",
		func: MahjongP2PService,
		runupdate: 'init',
		scope: "singleton"
	}]
};