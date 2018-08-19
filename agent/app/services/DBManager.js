var log = require('pomelo-logger').getLogger("hall", "DBManager");
var pomelo = require('pomelo');
var Tools = require('../GameUtils/Tools');

var DBManager = function() {
	//标识单例
	this.$scope = "singleton";
};

var dbm = DBManager.prototype;

//进入大厅在线
dbm.addUserOnline = function(d, cb) {
	if (d.uid) {
		var unix = Math.round(+new Date() / 1000);
		var obj = { userid: d.uid, gid: 0, rtype: 0, ridx: 0, tid: 0, pos: 0, login_time: unix, update_time: unix };
		if (d.gsid) {
			var gsid = d.gsid.split('_');
			obj.gid = gsid[0] || 0;
			obj.rtype = gsid[1] || 0;
			obj.ridx = gsid[2] || 0;
			obj.tid = d.tableid || 0;
			obj.pos = d.pos || 0;
		}
		pomelo.app.get('db').inserttablem('yly_online', obj, null, true);
	}
	if (cb) cb();
};
//退出游戏 回到大厅
dbm.removeUserOnline = function(uid, cb) {
	var unix = Math.round(+new Date() / 1000);
	var obj = { update_time: unix, gid: 0, rtype: 0, ridx: 0, tid: 0, pos: 0 };
	pomelo.app.get('db').updatetablem('yly_online', obj, { userid: uid });
	if (cb) cb();
};
//服务器重启 清理在线 全部回到大厅
dbm.removeUserOnlineByServer = function(gid, rtype, ridx, cb) {
	var unix = Math.round(+new Date() / 1000);
	var obj = { update_time: unix, gid: 0, rtype: 0, ridx: 0, tid: 0, pos: 0 };
	pomelo.app.get('db').updatetablem('yly_online', obj, { gid: gid, rtype: rtype, ridx: ridx });
	if (cb) cb();
};
//退出大厅
dbm.deleteUserOnline = function(uid, cb) {
	pomelo.app.get('db').deletetablem('yly_online', { userid: uid });
	if (cb) cb();
};

//用户在线时长
dbm.updateUserOnlineTime = function(uid, start, cb) {
	var end = Math.round(+new Date() / 1000);
	var time = end - (start || end);
	var sql = 'update user_achievement set onlinetime=onlinetime+' + time + ' where uid=' + uid;
	pomelo.app.get('db').newQuery(sql);

	var day = Tools.getDateKey(start, 'YYYYMMDD');
	sql = 'insert into log_user_liushui(ldate,uid,onlinetime) value('+day+','+uid+','+time+') on duplicate key update onlinetime=onlinetime+' + time;
	pomelo.app.get('db').newQuery(sql);
	if (cb) cb();
};

dbm.updateUserLiushuiCards = function(uid, day, cards, cb) {
	var sql = '';
	if (cards > 0) {
		sql = 'insert into log_user_liushui(ldate, uid, cards) value('+day+','+uid+','+cards+') on duplicate key update cards=cards+' + cards;
	} else {
		sql = 'insert into log_user_liushui(ldate, uid, cards) value('+day+','+uid+','+cards+') on duplicate key update cards=cards-' + (-cards);
	}
	
	pomelo.app.get('db').newQuery(sql);
	if(cb) cb();
}

dbm.updateUserVipCards = function(uid, cards, cb) {
	var sql = '';
	if (cards > 0) {
		sql = 'update game_userfield SET vip_card = vip_card +' + cards + ' where uid='+uid;
	} else {
		sql = 'update game_userfield SET vip_card = vip_card -' + (-cards) + ' where uid='+uid;
	}
	
	pomelo.app.get('db').newQuery(sql);
	if(cb) cb();
}

//创建房间
dbm.createUserRooms = function (obj, lid, cb) {
	obj.ltime = Math.round(+new Date() / 1000);
	var sql = 'insert into log_create_rooms set ?';
	pomelo.app.get('db').query(sql, obj, function(result){
		if (cb) cb(result && result.insertId ? result.insertId : 0);

		if (!result || !result.insertId) return;
		obj.lid = result.insertId;

		var sql = 'insert into game_mj_rooms set ?';
		pomelo.app.get('db').query(sql, obj);

		if (lid) pomelo.app.get('db').query('update log_user_golds set lid2=? where lid=?', [obj.lid, lid]);
	});
};
dbm.removeUserRoomByCode = function(code, cb) {
	var sql = 'delete from game_mj_rooms where code=?';
	pomelo.app.get('db').query(sql, [code]);
	if (cb) cb();
};
//房间结束
dbm.removeUserRooms = function (code, state, cb) {
	var sql = 'select lid from game_mj_rooms where code=?';
	pomelo.app.get('db').query(sql, [code], function(r){
		if (!r || r.length == 0) return;
		var lid = r[0].lid;

		var sql = 'update log_create_rooms set state=?,endtime=? where lid=?';
		pomelo.app.get('db').query(sql, [state, Math.round(+new Date() / 1000), lid]);

		var sql = 'delete from game_mj_rooms where code=?';
		pomelo.app.get('db').query(sql, [code]);
	});
	if (cb) cb();
};
//游戏服务器关闭时清理房间
dbm.removeRooms = function (gsid, cb) {
	pomelo.app.get('db').query('delete from game_mj_rooms where gsid=?', [gsid]);
	if (cb) cb();
};

//加卡
dbm.addRoomCards = function(uid, num, reasonno, reason, gameid, code, cb) {
	pomelo.app.get('db').query('call addroomcards(?,?,?,?,?,?);', [gameid||0, uid, num, reasonno, reason, code||0], function(result) {
		//log.warn('addRoomCards', uid, num, reasonno, reason, gameid, code, result);
		if (result && result[0]) cb(result[0][0]); else cb(null);
	});
};

//加礼券
dbm.addTickets = function(uid, num, reasonno, reason, gameid, cb) {
	pomelo.app.get('db').query('call addtickets(?,?,?,?,?);', [gameid||0, uid, num, reasonno, reason], function(result) {
		//log.warn('addTicket', uid, num, reasonno, reason, gameid, result);
		if (result && result[0]) cb(result[0][0]); else cb(null);
	});
};

//查询用户信息
dbm.getUser = function(uid, cb) {
	var sql = "select * from yly_member inner join game_userfield using(uid) where uid=" + uid;
	pomelo.app.get('db').q_first(sql).done(cb);
};
//配置
dbm.getGameConfig = function(id, cb) {
	var sql = "select cvalue from game_config where cid=" + id;
	pomelo.app.get('db').q_first(sql).then(function(r){ return r && r.cvalue ? parseInt(r.cvalue) || 0 : 0 }).done(cb);
};
//更改用户信息
dbm.updateUser = function(uid, level, experience, cb){
	pomelo.app.get('db').query('update game_userfield set level = ?,experience = experience + ? where uid = ?', [level, experience, uid]);
	if (cb) cb();
};

//记录普通升级信息
dbm.logUserLevel = function(uid, level, cb) {
    var ltime = Math.round(+new Date() / 1000);
    var sql = 'insert ignore into log_user_level(uid, level, ltime) values('+uid+','+level+','+ltime+')';
    pomelo.app.get('db').newQuery(sql);
    if (cb) cb();
}
//增加玩家道具
dbm.addUserProp = function(uid, pid, cb){
	pomelo.app.get('db').q_first('call adduserprops(?,?,?,@ret)', [uid, pid, 0]).then(function(r){return r;}).done(cb);
};
dbm.getGameLevel = function(cb){
	pomelo.app.get('db').q_query('select * from game_level').then(function(r){return r;}).done(cb);
};
dbm.getUserProp = function(uid,pid,cb){
	pomelo.app.get('db').q_first('select pid,expire,remain from user_props where uid = ? and pid = ?',[uid,pid]).then(function(r){return r;}).done(cb);
};
dbm.addUserRound = function(uid,cb){
	pomelo.app.get('db').query('update game_userfield set vip_rounds = vip_rounds + 1 where uid = ?', [uid]);
	if (cb) cb();
};
dbm.getUserProps = function(uid,cb){
	pomelo.app.get('db').q_query('select a.pid,a.expire from user_props as a inner join game_props as b on a.pid = b.pid where uid = ' + uid + ' and b.type = 1').then(function(r){return r;}).done(cb);
};
dbm.getGameProps = function(cb){
	pomelo.app.get('db').q_query('select * from game_props').then(function(r){return r;}).done(cb);
};
dbm.getVipConfig = function(cb){
	pomelo.app.get('db').q_query('select * from game_vip_level').then(function(r){return r;}).done(cb);
};
dbm.updateVip = function(uid,vip_level,vip_card,vip_day,cb){
	var unix = Math.round(+new Date() / 1000);
	var vip_expire = parseInt(new Date(new Date().toLocaleDateString()).getTime()/1000) + (parseInt(vip_day)+1) * 86400;
	pomelo.app.get('db').query('update game_userfield set vip_level = ?, vip_card = vip_card - ?, vip_time = ?,vip_expire = ?,vip_rounds = 0,vip_lstate = 1,vip_ltime = ? where uid = ?',
			[vip_level,vip_card,unix,vip_expire,unix,uid]);
	if (cb) cb();
};
//表情管理
dbm.getGameEmojis = function(cb){
    pomelo.app.get('db').q_query('select * from game_emojis').then(function(r){return r;}).done(cb);
};
dbm.getUserEmoji = function(uid,eid,cb){
    pomelo.app.get('db').q_first('select * from user_emojis where uid = ? and eid = ?',[uid,eid]).then(function(r){return r;}).done(cb);
};
dbm.addUserEmoji = function(uid, emoji, buy_state, cb){
    log.warn('addUserEmoji', uid, emoji);
    var ltime = Math.round(+new Date() / 1000);
    var sql = 'insert into user_emojis(uid, eid, type, `order`, ltime, buy_state, state) values('+uid+','+emoji.eid+','+emoji.type+','+emoji.order+','+ltime+','+buy_state+', 1)';
    pomelo.app.get('db').newQuery(sql);
    if (cb) cb();
};
dbm.getUserEmojis = function(uid,cb){
    pomelo.app.get('db').q_query('select * from user_emojis where uid = ' + uid).then(function(r){return r;}).done(cb);
};
dbm.getMatchConfig = function (cb) {
	var unix = Math.round(+new Date() / 1000);
	var sql = "select *,ifnull((select mlid from match_mlid where mid = game_match_config.mid),0) mlid from game_match_config where (ntype = 1 and endtime > "+unix+" and status = 1) or ntype = 2 or (ntype = 3 and ((times = 0 and endtime > "+unix+") or times > 0) and status = 1) or (ntype = 5 and status = 1) order by starttime desc";
	pomelo.app.get('db').q_query(sql).then(function(r){
		var matchs = {};
		if (r) for(var i = 0,len = r.length; i<len; i++) {
			r[i].game = JSON.parse(r[i].game);
			r[i].award = JSON.parse(r[i].award);
			matchs[r[i].mid] = r[i];
		}
		return matchs;
	}).done(cb);
};

dbm.getUserMatchScore = function(mid, mlid, uid, cb) {
	var sql = "select score from user_match_score where mid=? and uid=? and mlid = ? order by day desc";
	pomelo.app.get('db').q_first(sql, [mid, uid, mlid]).then(function(r){ return r; }).done(cb);
};


//创建房间消耗卡记录
dbm.createUserPrepaid = function (data, cb) {
	data.ltime = Math.round(+new Date() / 1000);
	var sql = 'insert ignore into game_mj_prepaid set ?';
	pomelo.app.get('db').query(sql, data);
	if (cb) cb();
};
dbm.deleteUserPrepaid = function(code, cb) {
	var sql = 'delete from game_mj_prepaid where code=?';
	pomelo.app.get('db').query(sql, [code]);
	if (cb) cb();
};
dbm.getAllPrepaid = function(cb){
	var now = Math.round(+new Date() / 1000) - 3 * 60 * 60;
	pomelo.app.get('db').q_query('select * from game_mj_prepaid where isowner=1 and ltime>=?', [now]).then(function(r){return r;}).done(cb);
};
dbm.updateRoomCardLog = function (code, cards, cb) {
	var sql = 'update log_create_rooms set cards=? where lid=(select lid from game_mj_rooms where code=? limit 1)';
	pomelo.app.get('db').query(sql, [cards, code]);
	if (cb) cb();
};
dbm.matchSign = function(uid, mid, obj, cb){
	var ltime = Math.round(+new Date() / 1000);
	var mlid = obj.mlid;
	var paytype = obj.paytype;
	var tickettype = obj.tickettype;
	var cost = obj.cost;
	var sql = 'insert into log_match_sign (uid,mid,mlid,ltime,paytype,tickettype,cost) value (?,?,?,?,?,?,?)';
	pomelo.app.get('db').query(sql, [uid, mid, mlid, ltime,paytype,tickettype,cost], function(result) {
		if (cb) cb(result && result.insertId ? parseInt(result.insertId) : 0);
	});
}
dbm.updateMatchSign = function(uid, mid, mlid, state, cb){
	var sql = "update log_match_sign set state = ? where uid = ? and mid = ? and mlid = ?";
	pomelo.app.get('db').query(sql, [state, uid, mid, mlid]);
	if (cb) cb();
}
dbm.getMatchSignTimes = function(uid,mid,cb){
	var time = new Date(new Date().setHours(0, 0, 0, 0)) / 1000;
	var sql = "select count(1) total from log_match_sign where uid = ? and mid = ? and ltime >= ? and state in (0,3)";
	pomelo.app.get('db').query(sql, [uid, mid, time], function(result) {;if (cb) cb(result && result[0] && result[0].total ? parseInt(result[0].total) : 0);});
}
dbm.addmatchticket = function(uid, tickettype, ticket, reasonno, reason, cb){
	pomelo.app.get('db').query('call addmatchticket(?,?,?,?,?);', [uid, reasonno, tickettype, ticket, reason], function(result) {
		if (result && result[0]) cb(result[0][0]); else cb(null);
	});
}
dbm.matchmlid = function(mid,cb){
	pomelo.app.get('db').query('call match_mlid(?);', [mid], function(result) {
		if (result && result[0]) cb(result[0][0]); else cb(null);
	});
}
dbm.getCSMatchSign = function(uid,mid,date,cb){
	var sql = "select uid,state from match_cs_user where uid=? and mid=? and date=?";
	pomelo.app.get('db').q_first(sql, [uid,mid,date]).then(function(r){return r; }).done(cb);
}
dbm.updateCSMatchSign = function(uid,mid,date,cb){
	var sql = "update match_cs_user set state = 3 where uid = ? and mid = ? and date = ?";
	pomelo.app.get('db').query(sql, [uid, mid, date]);
	if (cb) cb();
}
dbm.getMotors = function(num,cb){
	var sql = "select a.uid from yly_motor as a inner join yly_member as b on a.uid = b.uid inner join game_userfield as c on a.uid = c.uid and a.state = 0 and a.gameid = 1 order by a.uid desc limit ?";
	pomelo.app.get('db').q_query(sql,[num]).then(function(r){return r;}).done(cb);
}
dbm.updateMotor = function(uids,cb){
	var sql = "update yly_motor set state = 1 where uid in ("+ uids.join(',') +")";
	pomelo.app.get('db').query(sql);
	if (cb) cb();
}
dbm.updateMotorByUid = function(uid,cb){
	var sql = 'update yly_motor set state = 0 where uid = ?';
	pomelo.app.get('db').query(sql,[uid]);
	if (cb) cb();
}
dbm.addStones = function(gameid,uid,stones,reason,reasonno,code,cb){
	pomelo.app.get('db').query('call addstones(?,?,?,?,?,?);', [gameid||0, uid, stones, reasonno, reason, code||0], function(result) {
		if (result && result[0]) cb(result[0][0]); else cb(null);
	});
}
dbm.sendProp = function(uid,touid,code,pid,price,cash,cb){
	pomelo.app.get('db').query('call sendprop(?,?,?,?,?,?);', [uid,touid,code,pid,price,cash], function(result) {
		if (result && result[0]) cb(result[0][0]); else cb(null);
	});
}
dbm.matchHLSign = function(uid,mid,cb){
	var ltime = Math.round(+new Date() / 1000);
	var sql = 'insert into match_hl_user (uid,mid,ltime) value (?,?,?)';
	pomelo.app.get('db').query(sql, [uid, mid, ltime], function(result) {
		if (cb) cb(result && result.insertId ? parseInt(result.insertId) : 0);
	});
}
dbm.updateMatchHLSign = function(id,state,cb){
	var sql = 'update match_hl_user set state = ? where id = ?';
	pomelo.app.get('db').query(sql, [id, state]);
	if (cb) cb();
}
//包间信息
dbm.addCompartmentRoomCard = function(cid,uid,num,type,cb){
	var sql = 'call addCompartmentRoomCard(?,?,?,?)';
	pomelo.app.get('db').q_first(sql,[cid,uid,num,type]).done(cb);
}

dbm.getCompartmentMember = function(uid,cid,cb){
	var sql = "select *, b.status cpstatus from p2p_compartment_member as a " +
			  "inner join p2p_compartment as b on a.cid = b.id " +
			  "inner join p2p_family_member as c on b.familyid = c.familyid and a.uid = c.uid where a.uid=" + uid +" and a.cid="+cid;
	pomelo.app.get('db').q_first(sql).done(cb);
}
dbm.compartment = function(cid,uid,card,type,cb){
	pomelo.app.get('db').query('call compartment(?,?,?,?)',[uid,cid,card,type]);
	if (cb) cb();
}
dbm.getCreateRoom = function(code,cb){
	var sql = 'select * from game_mj_rooms where code = ?';
	pomelo.app.get('db').q_first(sql,[code]).done(cb);
}
dbm.addMatchPrize = function(data,cb){
	var sql = 'insert into log_match_prize set ?';
	pomelo.app.get('db').query(sql, data,function(result){
		if (cb) cb(result && result.insertId ? parseInt(result.insertId) : 0);
	});
}
dbm.updateCSMatchRank = function(mid,uid,date,id,cb){
	var sql = 'update match_cs_user set rid = ? where uid = ? and mid = ? and date = ?';
	pomelo.app.get('db').query(sql, [id, uid, mid, date]);
	if (cb) cb();
}
dbm.updateCSMatchState = function(mid,date,cb){
	var sql = 'update match_cs_user set isend = 1 where mid = ? and date = ?';
	pomelo.app.get('db').query(sql, [ mid, date]);
	if (cb) cb();
}
dbm.getCSBMUser = function(mid,date,cb){
	var sql = 'select count(1) total from match_cs_user where mid = ? and date = ?';
	pomelo.app.get('db').query(sql,[mid,date],function(result){
		if (cb) cb(result && result[0] && result[0].total ? parseInt(result[0].total) : 0);
	});
}

module.exports = {
	name: "hall",
	beans: [{
		id: "DBManager",
		func: DBManager,
		scope: "singleton"
	}]
};