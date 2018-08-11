module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;

handler.welcome = function(msg, session, next){
    console.log("msg-welcome:", msg);
    next(null, {code:200});
}