(function(){
    function TestDependency (console) {
        this.test = "test";
        console.log("test dependency");
    }

    module.exports = TestDependency
}).call(null);