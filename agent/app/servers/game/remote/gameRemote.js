module.exports = function(app) {
    return new GameRemote(app);
};

var GameRemote = function(app) {
    this.app = app;
    // this.channelService = app.get('channelService');
};

var _proto = GameRemote.prototype;

_proto.welcome = function(){
    console.log("the server connect msg come", arguments);
}