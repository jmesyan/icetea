var pomelo = require('pomelo');

var log = require('pomelo-logger').getLogger("hall", "GameServer");
var tools = require("../../gameutils/Tools");

var GameConst = require("../HotHelper").getGameConst();
var Code = require("../HotHelper").getCode();
var CMD = GameConst.CMD;
var hothelper = require("../HotHelper");


var GameHandlers  = function(){

};

var handler = GameHandlers.prototype;

handler.welcome = function(body){
    console.log("the welcome handler:", body);
}

module.exports = {
    name: "hall",
    beans: [{
        id: "GameHandlers",
        func: GameHandlers,
        scope: "singleton"
    }]
};