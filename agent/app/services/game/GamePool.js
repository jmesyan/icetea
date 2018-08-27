var pomelo = require("pomelo");
var log = require('pomelo-logger').getLogger("hall", "GamePool");
var tools = require("../../GameUtils/Tools");

var GamePool = function() { this.init(); };

var gp = GamePool.prototype;

gp.init = function(gid, rtype, cap, key){
    this.gid = gid;
    this.rtype = rtype;
    this.cap = cap;
    this.key = key;
    this.checkId = false;
    this.checkKey = 0;
    this.checkTimes = 0;
    this.list = [];
    return this;
};

gp.getPoolLength = function(){
    return this.list.length;
};

gp.getPoolCap = function(){
    return this.cap;
};

gp.setPoolRatio = function(low, high){
    this.low_ratio = low;
    this.high_ratio = high;
};

gp.setPoolParams = function(params){
  if (!tools.isObject(params)) return;
  for (var key in params){
      this[key] = params[key];
  }
};

gp.setCheckKey = function(value){
    this.checkKey = value;
    this.checkTimes = 0;
};

gp.setCheckId = function(cid){
  this.checkId = cid;
};

gp.addObj = function(obj){
    var self = this;
    var find = self.findObj(obj[this.key]);
    if (find.index == -1 && this.getPoolLength() < this.getPoolCap() && tools.isObject(obj)){
        this.list.push(obj);
        return true;
    }
    return false;
};

gp.findObj = function(value){
    result = {index:-1, obj:null}
    for(var i = 0; i < this.getPoolLength(); i++){
        if (!!this.list[i][this.key] && this.list[i][this.key] == value){
            result = {index:i, obj:this.list[i]};
            break;
        }
    }
    return result;
};


gp.removeObj = function(value){
    var self = this;
    var find = self.findObj(value);
    if (find.index > -1){
        this.list.splice(find.index, 1);
        return true;
    }
    return false;
};

gp.clearPool = function(){
    this.removeCheck();
    this.list = [];
    this.checkKey = 0;
    this.checkId = false;
};

gp.sortPool = function(sortFunc){
    var list = this.list;
    this.list = list.sort(sortFunc);
};

gp.removeCheck = function(){
    if (!!this.checkId){
        clearInterval(this.checkId);
        this.checkId = false;
    }
    this.checkTimes = 0;
};

module.exports = {
    name: "hall",
    beans: [{
        id: "GamePool",
        func: GamePool
    }]
};