/* eslint-disable prettier/prettier */
Module.register("mmm-nest", {
    // Default module config.
    defaults: {
        text: "Hello World!"
    },

    // Override dom generator.
    getDom: function () {
        var wrapper = document.createElement("div");
        wrapper.innerHTML = this.config.text;
        return wrapper;
    }
});