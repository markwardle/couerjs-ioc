(function(){
    var TestObject = function TestObject(console, testDependency) {
        this.dependency = testDependency;
        this.test = null;

        console.log("test object");
    };

    TestObject.prototype.testSetter = function(test) {
        this.test = test;
    };

    module.exports = TestObject
}).call(null);