var log = require('pomelo-logger').getLogger("hall", "MatchServer");
var pomelo = require("pomelo");
var hothelper = require("./HotHelper");
var code = hothelper.getCode();
var pushCmd = require("../common/GameConst").pushCmd;
var tools = require("../GameUtils/Tools");
var randomAssignGameTable = hothelper.getRandomAssignGameTable();
var gsManager = hothelper.getGameServerManager();
var userManager = hothelper.getUserManager();
var temporaryBadTable = hothelper.getTemporaryBadTable();
var GameConst = hothelper.getGameConst();
var sys = require("./StoreDatas").sys;
var bs = require("./StoreDatas").bs;
var p2p = require("./StoreDatas").p2p;
var Code = hothelper.getCode();
var serversort = require("./StoreDatas").serversort;

var MatchCGServer = function() { };
var server = MatchCGServer.prototype;

server.init = function(){
	if(pomelo.app.getServerType()!="hall")return;
	if (!bs.ms) bs.ms = {}; //存所有比赛信息
	if (!bs.gs) bs.gs = {}; //存所有比赛gid=>mid

	if (!bs.mlid) bs.mlid = {};//常规赛mlid
	if (!bs.su) bs.su = {};//常规赛用户
	if (!bs.mu) bs.mu = {};//玩家报名人数

	if (!bs.fr) bs.fr = {};//进桌失败的用户
	if (!bs.ft) bs.ft = {};//进桌失败的次数

	if (!bs.mt) bs.mt = {};//常规赛桌子
	if (!bs.at) bs.at = {};//记录玩家本次参加常规赛次数
	if (!bs.cgt) bs.cgt = {};//已进行的场次
};

//重启初始化比赛用户信息
server.initUser = function(userinfo){
	var uid = userinfo.uid,mid = userinfo.mid;
	var m = bs.ms[mid];
	if(!m) return;

	if(!bs.su) bs.su = {};
	if(!bs.su[mid]) bs.su[mid] = {};
	bs.su[mid][uid] = {state:userinfo.state,costState:0};//初始比赛数据

	if(!bs.mu) bs.mu = {};
	if(!bs.mu[mid]) bs.mu[mid] = 0;
	if(userinfo.state == 1) bs.mu[mid]++;

	var player = userManager.getOnlineUserSort(uid);
	if(player){
		player.mid = mid;
		player.mlid = userinfo.mlid;
		player.stage = userinfo.stage;
		player.type = userinfo.qt;
	}else{
		var user = {uid:uid,mid:mid,mlid:userinfo.mlid,stage:userinfo.stage,type:userinfo.qt};
		userManager.addUserSort(uid,null,user);
	}
}

//比赛状态通知
server.noticeMatch = function(body) {
	if (!bs.ms[body.mid]) return log.error('比赛不存在 mid：', body.mid);
	var mid = body.mid, m = bs.ms[mid], gid = m.gid;
	bs.gs[gid] = mid;
	if(body.rel == 1){
		if(!bs.su) bs.su = {};
		if(!bs.su[mid]) bs.su[mid] = {};
		for(var uid in bs.su[mid]) {
			var player = userManager.getOnlineUserSort(uid);
			if(player){
				delete player.mid;
				delete player.mlid;
				delete player.type;
				delete player.stage;
				delete player.rank;
				delete player.score;
				delete player.num;
				if(player.reload) delete player.sid;
				pomelo.app.get('matchServer').removeUser(u.uid,player.reload?false:true);//清除不在线玩家信息
			}
			delete bs.su[mid][uid];
		}
		bs.ss[mid] = 1;
		if(!bs.cgt) bs.cgt = {};
		bs.cgt[mid] = 0;
		console.log(1, '常规赛开始 mid：', mid, gid);
	}else if (body.rel == 2) { //结束
		bs.ss[mid] = 2;
		bs.mu[mid] = 0;
		for (var uid in bs.su[mid]) {
			if(bs.su[mid][uid].state == 1){
				var player = userManager.getOnlineUserSort(uid);
				if(player && !player.reload) player.sendMsg('matchend',{mid:mid});
				if (bs.su[mid][uid].costState > 0) this.refundMatchCost(uid,mid);
				var player = userManager.getOnlineUserSort(uid);
				pomelo.app.rpc.db.dbRemote.updateMatchSign(null,uid,mid,player.mlid,2,function(){});
				delete player.mid;
				delete player.mlid;
				delete bs.su[mid][uid];
			}
		}
		if(!bs.at) bs.at = {};
		bs.at[mid] = {};
	}else if(body.rel == 99){//常规赛场次已满
		if(!bs.cgt) bs.cgt = {};
		bs.cgt[mid] = m.times;
	}
};
//比赛报名
server.bsbm = function(me, session, body, next){
	//维护开关
	if (pomelo.app.get('mjP2PService').checkSysMaintenance(me, session, next)) return next(null,{code:code.FAIL,msg:'系统维护中!'});

	var self = this,mid = body.mid;
	var m = bs.ms[mid], time = tools.getSystemSecond(),h = tools.getHour();

	if(!m) return next(null, {code: code.FAIL, msg: '比赛不存在！'});
	
	if (h < m.starttime)
		return next(null, {code: code.FAIL, msg: '比赛未开始！',match: m });
	else if (h >= m.endtime)
		return next(null, {code: code.FAIL, msg: '比赛已经结束！',match: m });

	bs.gs[m.gid] = mid;

	if(!bs.cgt) bs.cgt = {};
	if(!bs.cgt[mid]) bs.cgt[mid] = 0;

	if(m.times > 0 && bs.cgt[mid] >= m.times) return next(null, {code: code.FAIL, msg: '本场比赛的次数已达上限!',match: m });

	if(!bs.su) bs.su = {};
	if(!bs.su[mid]) bs.su[mid] = {};

	if(!bs.at) bs.at = {};
	if(!bs.at[mid]) bs.at[mid] = {};
	if(!bs.at[mid][session.uid]) bs.at[mid][session.uid] = 0;

	if (m.attendtimes > 0 && bs.at[mid][session.uid] >= m.attendtimes) return next(null, {code: code.FAIL, msg: '本场比赛的次数已达上限！', match: m });

	var player = userManager.getOnlineUserSort(session.uid);
	if (!!player.mid) return next(null, {code: code.FAIL, msg: '已经报名参加比赛！', match: m });

	var len = p2p.mj.nouse[m.gid] ? p2p.mj.nouse[m.gid].length : 0;
	if (len == 0) return next(null, {code: code.FAIL, msg: '本次比赛服务器已满，请稍后再试。', match: m });

	if (m.uday && m.uday > 0) {
		var check = player.reg_date && time - player.reg_date > m.uday*86400;
		if (check) {
			console.error('您不满足参赛条件！', session.uid);
			return next(null, {code: code.FAIL, msg: '您不满足参赛条件！', match: m });
		}
	}
	if (m.ucards && m.ucards > 0) {
		if (player.room_card && player.room_card < m.ucards) {
			console.error('您不满足参赛条件！', session.uid, player.room_card);
			return next(null, {code: code.FAIL, msg: '您不满足参赛条件！', match: m});
		}
	}

	var lockKey = 'bsbm_' + session.uid;
	if (pomelo.app.get('lock').start(lockKey)) return me.error(session, next, 'actionFrequently', 'rel');

	if (m.costtype > 0 && m.cost > 0) {
		var times = !!bs.at[mid] && !!bs.at[mid][session.uid] ? bs.at[mid][session.uid] : 0;
		console.log('times',session.uid,times);
		if (times >= m.freetimes) {
			self.matchCost(player,m,next,session,lockKey);
		}else{
			self.matchSign(player,m,0,session,next,lockKey);
		}
	}else{
		self.matchSign(player,m,0,session,next,lockKey);
	}
}
//报名消耗礼券
server.matchCost = function(player,m,next,session,lockKey){
	var self = this;
	var costtype = parseInt(m.costtype) || 0;
	switch (costtype) {
		case 1://礼券报名
			if(m.cost > player.ticket){
				pomelo.app.get('lock').end(lockKey);
				return next(null, {code: code.FAIL, msg: '礼券不足报名失败！', match: m});
			}
			pomelo.app.rpc.db.dbRemote.addTickets(null, session.uid, -m.cost, Code.TICKET.P2P_MATCH_SIGN_USE_TICKET, '常规赛:'+m.mid+',报名消耗礼券:' + m.cost, m.gid, function(r) {
				if (r && r.nums > -1) {
					player.ticket = r.nums;
					player.sendMsg(GameConst.pushCmd.ticketChange, { ticket: player.ticket, num: -m.cost ,isjb:0});
					self.matchSign(player,m,1,session,next,lockKey);
				} else {
					pomelo.app.get('lock').end(lockKey);
					return next(null, {code: code.FAIL, msg: '礼券不足报名失败！', match: m });
				}
			});
			break;
		case 2://房卡报名
			if(m.cost > player.room_card){
				pomelo.app.get('lock').end(lockKey);
				return next(null, {code: code.FAIL, msg: '元宝不足报名失败！', match: m });
			}
			pomelo.app.rpc.db.dbRemote.addRoomCards(null, session.uid, -m.cost, Code.GOLD.P2P_MATCH_SIGN_USE_ROOMCARD, '常规赛:'+m.mid+',报名消耗房卡:' + m.cost, m.gid, m.code, function(r) {
				if (r && r.nums > -1) {
					player.room_card = r.nums;
					player.card_use = player.card_use + m.cost;
					player.sendMsg(GameConst.pushCmd.roomCardsChange, { room_card: player.room_card, cards: -m.cost, card_use: player.card_use });
					pomelo.app.get('mjP2PService').updateVip(session.uid);
					self.matchSign(player,m,2,session,next,lockKey);
				} else {
					pomelo.app.get('lock').end(lockKey);
					return next(null, {code: code.FAIL, msg: ' 元宝不足报名失败！', match: m });
				}
			})
			break;
		default:
			pomelo.app.get('lock').end(lockKey);
			return next(null, {code: code.FAIL, msg: '报名失败,请重试！', match: m });
			break;
	}
}
//常规赛报名
server.matchSign = function(player,m,costState,session,next,lockKey){
	var mid = m.mid,self = this;

	if (!bs.mlid) bs.mlid = {};
	if (!bs.mlid[mid]) bs.mlid[mid] = parseInt(m.mlid) + 1;

	var mlid = bs.mlid[mid];

	if (!bs.mu) bs.mu = {};
	if (!bs.mu[mid]) bs.mu[mid] = 0;

	var nowtime = tools.getSystemMillSecond();

	var bsbmCallback = function(body) {

		console.log('常规赛报名',body.uid,'时间:',tools.getSystemMillSecond()-nowtime,JSON.stringify(body));

		if (body.type == 0) {//报名返还
			if (body.rel == 0) {//报名成功
				pomelo.app.rpc.db.dbRemote.matchSign(null,body.uid,body.mid,body.mlid,function(insertid){})
				bs.su[body.mid][body.uid] = {state:1,costState:costState,mlid:body.mlid,stage:1};//报名比赛成功
				bs.at[mid][body.uid]++;
				body.srule = eval('('+body.srule+')');
				bs.mu[body.mid] = body.srule.users;
				if(body.srule.start == 1 && body.srule.users >= m.users) {
					bs.mlid[body.mid] += 1;
					bs.mu[body.mid] = 0;
					//pomelo.app.rpc.db.dbRemote.matchmlid(null,mid,function(){})
					bs.cgt[mid]++;
				}
				var user = {uid:body.uid,mid:mid,mlid:body.mlid};
				userManager.addUserSort(body.uid,null,user).then(function(player){
					pomelo.app.get('lock').end(lockKey);
					return next(null,{code: code.OK, num: body.srule.users,m:m});
				});
			} else {
				if(costState > 0) self.refundMatchCost(body.uid,mid);
				pomelo.app.get('lock').end(lockKey);
				var msg = ['比赛不存在,报名失败!','已在比赛中,报名失败!','报名生成失败,请重试!','比赛状态不对!','比赛报名人数已满!','本场比赛的次数已达上限!'];
				var msgtype = parseInt(body.rel)-1;
				return next(null, {code: code.FAIL, msg: msg[msgtype]?msg[msgtype]:'报名失败,请重试！', match: m });
			}
		}
	}

	//console.log('常规赛报名',m.gsid);
	var server = gsManager.getServerByGSID(m.gsid);
	if (server) {
		server.sendString('03SIGN{0}|{1}|{2}|{3}'.format(gsManager.getTick(bsbmCallback), mid, session.uid, mlid));
	} else {
		if(costState > 0) self.refundMatchCost(session.uid,mid);//报名失败退报名费
		pomelo.app.get('lock').end(lockKey);
		return next(null, {code: code.FAIL, msg: '报名失败,请重试！', match: m });
	}
}
//报名失败去报名费
server.refundMatchCost = function(uid,mid){
	var m = bs.ms[mid];
	if(!m) return;
	var cost = m.cost,costtype = m.costtype,gameid = m.gid,code = m.code;
	var player = userManager.getOnlineUserSort(uid);
	switch (costtype) {
		case 1:
			pomelo.app.rpc.db.dbRemote.addTickets(null, uid, cost, Code.TICKET.P2P_MATCH_SIGN_REFUND_TICKET, '比赛报名失败返还礼券:' + cost, gameid, function(r) {
				if (r && r.nums > -1) {
					player.ticket = r.nums;
					player.sendMsg(GameConst.pushCmd.ticketChange, { ticket: player.ticket, num: cost ,isjb:0});
				}
			})
			break;
		case 2:
			pomelo.app.rpc.db.dbRemote.addRoomCards(null, uid, cost, Code.GOLD.P2P_MATCH_SIGN_REFUND_ROOMCARD, '比赛报名失败返还房卡:' + cost, gameid, code, function(r) {
				if (r && r.nums > -1) {
					player.room_card = r.nums;
					player.card_use = player.card_use - m.cost;
					player.sendMsg(GameConst.pushCmd.roomCardsChange, { room_card: player.room_card, cards: cost, card_use: player.card_use });
					pomelo.app.get('mjP2PService').updateVip(uid);
				}
			})
			break;
		default:
			break;
	}
}

//取消报名
server.matchUnsign = function(me, session, body, next){
	var mid = body.mid,self = this;
	var m = bs.ms[mid];
	if(!m) return next(null, {code: code.FAIL, msg: '比赛不存在！'});
	if(!bs.su[mid] || !bs.su[mid][session.uid]) return next(null, {code: code.FAIL, msg: '未参加比赛,取消报名失败！'});
	if(!bs.su[mid]) bs.su[mid] = {};
	var bm = bs.su[mid][session.uid];
	if(bm.state == 2) return next(null, {code: code.FAIL, msg: '比赛已开始,取消报名失败！', match: m});

	var lockKey = 'bsbm_' + session.uid;
	if (pomelo.app.get('lock').start(lockKey)) return me.error(session, next, 'actionFrequently', 'rel');

	var matchUnsignCallback = function(body){
		console.log('常规赛取消报名',JSON.stringify(body));
		if (body.type == 1) {
			var player = userManager.getOnlineUserSort(body.uid);
			if (body.rel == 0) {
				if (parseInt(bm.costState) > 0) self.refundMatchCost(body.uid,body.mid);
				pomelo.app.rpc.db.dbRemote.updateMatchSign(null,body.uid,body.mid,body.mlid,2,function(){
					if(player){
						delete player.mid;
						delete player.mlid;
						delete player.type;
					}
					if(!bs.at) bs.at = {};
					if(!bs.at[mid]) bs.at[mid] = {};
					if(!bs.at[mid][body.uid]) bs.at[mid][body.uid] = 0;
					if(bs.at[mid][body.uid] > 0) bs.at[mid][body.uid]--;
					body.srule = eval('('+body.srule+')');
					bs.mu[body.mid] = parseInt(body.srule.users);
					delete bs.su[mid][session.uid];
					pomelo.app.get('lock').end(lockKey);
					return next(null, {code: code.OK,num:bs.mu[body.mid]});
				});
			} else if(body.rel == 2){
				if(player){
					delete player.mid;
					delete player.mlid;
					delete player.type;
				}
				delete bs.su[mid][session.uid];
				pomelo.app.get('lock').end(lockKey);
				return next(null, {code: code.OK,num:bs.mu[body.mid]});
			} else {
				var msg = ['不能强退!','未报名比赛,取消报名失败!','玩家不属于报名状态!','比赛状态不对!'];
				var msgtype = parseInt(body.rel)-1;
				pomelo.app.get('lock').end(lockKey);
				return next(null, {code: code.FAIL, msg: msg[msgtype]? msg[msgtype]:'取消报名失败,请重试！', match: m});
			}
		}
	}

	if(m.gsid) var server = gsManager.getServerByGSID(m.gsid);
	//console.log(server);
	if (server) {
		var player = userManager.getOnlineUserSort(session.uid);
		server.sendString('03USIN{0}|{1}|{2}|{3}'.format(gsManager.getTick(matchUnsignCallback), mid, session.uid, player.mlid));
	} else {
		pomelo.app.get('lock').end(lockKey);
		return next(null, {code: code.FAIL, msg: '取消报名失败,请重试！', match: m});
	}
}
//强制退赛
server.forceQuitMatch = function(me, session, body, next){
	var mid = body.mid,self = this;
	var m = bs.ms[mid];
	if(!m) return next(null, {code: code.FAIL, msg: '比赛不存在！', match: m});

	var player = userManager.getOnlineUserSort(session.uid);
	if(!player) return next(null, {code: code.FAIL, msg: '未参加比赛,强制退赛失败！', match: m});

	if(!bs.su[mid] || !bs.su[mid][session.uid] || !player.mid) return next(null, {code: code.FAIL, msg: '未参加比赛,强制退赛失败！', match: m});

	var FQCallback = function(body){
		console.log('常规赛强退',JSON.stringify(body));
		var bm = bs.su[mid][session.uid],state = 3;
		var player = userManager.getOnlineUserSort(body.uid);
		if (bm.state == 1) {//未开赛,是取消报名
			if (bm.costState > 0) self.refundMatchCost(body.uid,body.mid);
			if(!bs.at) bs.at = {};
			if(!bs.at[mid]) bs.at[mid] = {};
			if(!bs.at[mid][body.uid]) bs.at[mid][body.uid] = 0;
			if(bs.at[mid][body.uid] > 0) bs.at[mid][body.uid]--;
			delete player.mid;
			delete player.mlid;
			state = 4;
			delete bs.su[mid][session.uid];
		} else {
			bs.su[mid][session.uid].state = 2;
			player.type = 1;//强退
		}
		pomelo.app.rpc.db.dbRemote.updateMatchSign(null,body.uid,body.mid,body.mlid,state,function(){});
		delete player.gsid;
		delete player.tableid;
		return next(null, {code: code.OK});
	}

	if(m.gsid) var server = gsManager.getServerByGSID(m.gsid);
	if (server) {
		server.sendString('03FQIT{0}|{1}'.format(gsManager.getTick(FQCallback), session.uid));
	} else {
		return next(null, {code: code.FAIL, msg: '退赛失败,请重试！', match: m});
	}
}
//玩家进桌
server.matchEnterRoom = function(body){
	console.log('常规赛分桌',JSON.stringify(body));
	var tableusers = body.tableusers , mid = body.mid , stage = body.stage, round = body.round;
	var m = bs.ms[mid];
	if(!m) return;//比赛不存在
	var obj = {},gobj = {};
	for(var k in m.game) {obj[k] = m.game[k]; gobj[k] = m.game[k];}
	gobj.mid = mid; gobj.stage = stage; gobj.round = round;gobj.rounds = round > 0 ? round : 1;
	for(var i in tableusers) this.enterRoom(tableusers[i],mid,gobj,obj);
}
server.enterRoom = function(tableuser,mid,gobj,obj){
	var m = bs.ms[mid],self = this;
	if(!m) return;//比赛不存在
	var gid = tableuser.gid,rtype = tableuser.rtype,ridx = tableuser.ridx,tid = tableuser.tid,users = tableuser.users;
	var gsidtid = gid + '_' + rtype + '_' + ridx + '_' + tid;
	var gsid = gid + '_' + rtype + '_' + ridx;

	//桌子mid
	if (!bs.mt) bs.mt = {};
	bs.mt[gsidtid] = mid;

	//拉用户失败时需要用到的数据
	if(!bs.fr) bs.fr = {};
	tableuser.stage = gobj.stage;
	tableuser.round = gobj.round;
	bs.fr[gsidtid] = tableuser;

	if(!bs.ft) bs.ft = {};
	bs.ft[gsidtid] = 0

	while(p2p.mj.nouse[gid].indexOf(gsidtid) != -1) {
		var index = p2p.mj.nouse[gid].indexOf(gsidtid);
		p2p.mj.nouse[gid].splice(index, 1);
	}
	var code = randomAssignGameTable.randCode();
	obj.gsid = gsid;obj.tid = tid,obj.uid = users[0],obj.mid = mid,obj.code = code;
	pomelo.app.rpc.db.dbRemote.createUserRooms(null, obj, 0, function(lid) {//插入桌子数据
		self.enterMRoom(users,gobj,gsidtid,m,lid,code);
	});
}
server.enterMRoom = function(users,gobj,gsidtid,m,lid,code){
	var self = this;
	for (var k in users) self.enterMatchRoom(users[k],gobj,gsidtid,m,lid,code);
}
server.enterMatchRoom = function(uid,gobj,gsidtid,m,lid,code){
	var self = this;
	var gdata = gsidtid.split('_');
	userManager.addUserSort(uid,null,{stage:gobj.stage,mid: m.mid}).then(function(player){
		var mlid = parseInt(player.mlid) || 0;
		if(mlid < 1) {
			mlid = !!bs.su && !!bs.su[m.mid] && !!bs.su[m.mid][uid] ? parseInt(bs.su[m.mid][uid].mlid) : 0;
			player.mlid = mlid;
		}
		gobj.mlid = mlid;gobj.lid = lid;gobj.code = code;
		var msg = { gid: gdata[0], rtype: gdata[1], ridx: gdata[2], quick:0, tableid: gdata[3], mid: m.mid , gobj: gobj};
		if(!!player.motor && player.motor == 1) msg.motor = 1;
		if(!!m.scorescale) msg.scorescale = m.scorescale;
		//console.log('enterMatchRoom',uid,JSON.stringify(gobj));
		randomAssignGameTable.addUserToTable(gsidtid, parseInt(uid));
		self.userToGame(uid,player,gsidtid,m,msg);
	})
}
server.userToGame = function(uid,player,gsidtid,m,msg){
	var gdata = gsidtid.split('_'),mid = m.mid;
	gsManager.enterToGame(player, msg, player.locale || 'zh_CN', function(result) {
		console.log('常规赛进桌',uid,JSON.stringify(result));
		if (!result.uid) result.uid = uid;
		if (result.rel != 0) console.log(5, '比赛进入游戏失败:', gsidtid, uid, JSON.stringify(result));
		if (result.rel == 0) {
			var server = gsManager.getServerByGSID(m.gsid);
			if(server) server.n2s(gdata[0],gdata[1],gdata[2],'00','MSG0{0}|{1}|{2}|{3}|{4}'.format(mid,uid,player.mlid,gdata[3],0));
			if(!!bs.su && !!bs.su[mid] && !!bs.su[mid][uid]) bs.su[mid][uid].state = 3;
		}
	});
}
//server.unonlinUserToGame = function(uid,gsidtid,m,msg){
//	console.log('unonlinUserToGame',gsidtid,uid);
//	var self = this;
//	pomelo.app.get('cache').getUser(uid).then(function(player) {
//		player = CPlayer(player);
//		player.init(player);
//		self.userToGame(uid,player,gsidtid,m,msg);
//	})
//}
server.matchRank = function(body){
	var self = this;
	if(!bs.su) setTimeout(function(){self.matchRank(body);},1000)
	else {
		console.log('常规赛晋级',JSON.stringify(body));
		var num = 0;
		for(var i in body.users) num++;
		for(var i in body.users){
			var u = body.users[i];
			var player = userManager.getOnlineUserSort(u.uid);
			var mid = body.mid,mlid = u.mlid;
			if(u.bup == 0){//玩家淘汰删除数据
				if(!!bs.su[mid][u.uid]) delete bs.su[mid][u.uid];
				if(player) {
					delete player.mid;
					delete player.mlid;
					delete player.type;
					delete player.stage;
					delete player.rank;
					delete player.score;
					delete player.num;
					if(player.reload) delete player.sid;
					pomelo.app.get('matchServer').removeUser(u.uid,player.reload?false:true);//清除不在线玩家信息
				}
			}else{
				player.rank = u.rank;
				player.score = u.score;
				player.num = num;
				player.stage = parseInt(body.stage)+1;
				bs.su[mid][u.uid].stage = player.stage;
			}
			player = userManager.getOnlineUserSort(u.uid);//查看玩家是否在线
			if(player) {
				var data = {state:u.bup==1?1:2,num:num,rank: u.rank,score: u.score,bend:body.bend,stage:body.stage,mid:mid,mlid:mlid};
				console.log('常规赛晋级消息', u.uid,JSON.stringify(data));
				player.sendMsg(pushCmd.matchresult,data);
			}
		}
		console.log('常规赛玩家', JSON.stringify(bs.su[mid]));
	}
}
//游戏结束
server.endGame = function(body) {
	console.log('常规赛每局游戏结束：', JSON.stringify(body));
	var gsid = body.gid + '_' + body.rtype + "_" + body.ridx;
	var gsidtid = gsid + '_' + body.tid;
	pomelo.app.rpc.db.dbRemote.removeUserRooms(null, body.code, 1); //结束不退卡
	randomAssignGameTable.deleteByUse(gsidtid, body.code, sys['SYS_MAINTENANCE_' + gsid]); //删除已经使用

	var self = this,mid = 0;

	if(!bs.mt) bs.mt = {};
	mid = !!bs.mt[gsidtid] ? bs.mt[gsidtid] : 0;
	mid = mid ? mid : bs.gs[body.gid];

	var m = bs.ms[mid];
	var server = gsManager.getServerByGSID(gsid);
	if (!!server) {
		var table = server.getTable(body.tid);
		if (!!table) table.dispose();
	}

	if(body.rel == 1){//拉游戏失败,重新拉进房间
		var mserver = gsManager.getServerByGSID(m.gsid);
		if(mserver){
			if(bs.fr[gsidtid]){
				var tableusers = bs.fr[gsidtid];
				var users = tableusers.users;
				if(bs.ft[gsidtid] < 2){
					bs.ft[gsidtid] += 1;
					while(p2p.mj.nouse[body.gid].indexOf(gsidtid) != -1) {
						var index = p2p.mj.nouse[body.gid].indexOf(gsidtid);
						p2p.mj.nouse[body.gid].splice(index, 1);
					}
					var code = randomAssignGameTable.randCode();
					var obj = {},gobj = {};
					for(var k in m.game) {obj[k] = m.game[k]; gobj[k] = m.game[k];}
					obj.code = code;obj.uid = users[0];obj.gsid = gsid;obj.tid = body.tid;
					gobj.mid = mid; gobj.stage = tableusers.stage; gobj.round = tableusers.round;
					pomelo.app.rpc.db.dbRemote.createUserRooms(null, obj, 0, function(lid) {//插入桌子数据
						gobj.lid = lid;gobj.code = code;
						for (var i in users){
							var uid = users[i];
							var player = userManager.getOnlineUserSort(uid);
							gobj.mlid = player.mlid;
							var msg = { gid: body.gid, rtype: body.rtype, ridx: body.ridx, quick:0, tableid: body.tid, mid: mid , gobj: gobj};
							self.userToGame(uid,player,gsidtid,m,msg);
						}
					})
				}else{
					var tableusers = bs.fr[gsidtid];
					var faildata = [];
					for(var i in users){
						var player = userManager.getOnlineUserSort(users[i]);
						faildata.push({uid:users[i],score:parseInt(player.score)||0});
					}
					mserver.n2s(body.gid,body.rtype,body.ridx,'00','FAIL{0}|{1}|{2}|{3}'.format(mid,body.tid,JSON.stringify(faildata),tableusers.stage))
					delete bs.ft[gsidtid];
					delete bs.fr[gsidtid];
					delete bs.mt[gsidtid];
				}
			}else{
				var tableusers = bs.fr[gsidtid];
				var faildata = [];
				for(var i in users){
					var player = userManager.getOnlineUserSort(users[i]);
					faildata.push({uid:users[i],score:parseInt(player.score)||0});
				}
				mserver.n2s(body.gid,body.rtype,body.ridx,'00','FAIL{0}|{1}|{2}|{3}'.format(mid,body.tid,JSON.stringify(faildata),tableusers.stage))
				delete bs.ft[gsidtid];
				delete bs.fr[gsidtid];
				delete bs.mt[gsidtid];
			}
		} else {//中心服务器中断,删除数据
			delete bs.ft[gsidtid];
			delete bs.fr[gsidtid];
			delete bs.mt[gsidtid];
		}
	}else{
		for (var key in body.musers) {
			var uid = body.musers[key].uid;
			if (!!bs.su[mid][uid]) bs.su[mid][uid].state = 4;
		}
		delete bs.fr[gsidtid];
		delete bs.ft[gsidtid];
		delete bs.mt[gsidtid];
	}
};
//中心服务器断开,比赛结束
server.matchEnd = function(gid,mid){
	var key = gid + '_';
	for (var gsid in serversort) {
		if (gsid.indexOf(key) == 0) pomelo.app.get('gameserverManager').kickAllTable(gsid);
	}
	//if(!!bs.mlid) delete bs.mlid[mid];
	if(!!bs.mu) delete bs.mu[mid];
	if(bs.su && bs.su[mid]) {
		for(var uid in bs.su[mid]) {
			var player = userManager.getOnlineUserSort(uid);
			if(player){
				delete player.mid;
				delete player.mlid;
				delete player.type;
				delete player.stage;
				delete player.rank;
				delete player.score;
				delete player.num;
				if(player.reload) delete player.sid;
				pomelo.app.get('matchServer').removeUser(uid,player.reload?false:true);//清除不在线玩家信息
				player = userManager.getOnlineUserSort(uid);
				if(player){
					var data = {state:3,num:0,rank: 0,score: 0,bend:0,stage:0,mid:mid,mlid:0};
					player.sendMsg(pushCmd.matchresult,data);
				}
			}
			delete bs.su[mid][uid];
		}
		delete bs.su[mid];
		if(!!bs.at[mid]) delete bs.at[mid];
	}
	console.log('常规赛比赛结束',JSON.stringify(bs.su),JSON.stringify(bs.mlid),JSON.stringify(bs.mu))
}
server.motorSign = function(body){
	var uid = parseInt(body.uid) || 0;
	var mid = parseInt(body.mid) || 0;
	var mlid = parseInt(body.mlid) || 0;
	if(uid < 1 || mid < 1 || mlid < 1) return;
	var match = !!bs.ms && !!bs.ms[mid] ? bs.ms[mid] : false;
	if(!match) return;
	bs.su[body.mid][body.uid] = {state:1,costState:0,motor:1};//报名比赛成功
	if(bs.mlid[mid] == mlid) bs.mu[body.mid] = bs.mu[body.mid] + 1;
	if(bs.mu[mid] >= match.users && bs.mlid[mid] == mlid) {
		bs.mlid[body.mid] += 1;
		bs.mu[body.mid] = 0;
		pomelo.app.rpc.db.dbRemote.matchmlid(null,mid,function(){})
		bs.cgt[mid]++;
	}
	var user = {uid:body.uid,mid:mid,mlid:body.mlid,motor:1};
	userManager.addUserSort(body.uid,null,user);
}

module.exports = {
	name: "hall",
	beans: [{
		id: "MatchCGServer",
		func: MatchCGServer,
		runupdate: 'init',
		scope: "singleton"
	}]
};


