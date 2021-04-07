/* eslint-disable prettier/prettier */
Module.register("mmm-nest", {
    // Default module config.
    defaults: {
        starlingIP: this.config.starlingIP,
        apiURL: "api/connect/v1/devices/",
        deviceID: this.config.deviceID,
        apiKey: this.config.apiKey,
        currentTemp: 0,
        currentHumidity: 0,
        hvacMode: "",
        fanRunning: false,
        ecoMode: false,
    },

    // Override dom generator.
    getDom: function () {
        var wrapper = document.createElement("div");
        wrapper.innerHTML = "Mode: " + this.hvacMode + "<br />Temperature: " + this.currentTemp + "°F<br />Humidity: " + this.currentHumidity + "%";
        this.updateTemp();
        return wrapper;
    },

    getHeader: function () {
        return "Nest Thermostat";
    },

    getScripts: function () {
        return [
            this.file('nest.js')
        ];
    },

    getStyles: function () {
        return ["mmm-nest.css"];
    },

    updateTemp: function () {
        const url = this.config.starlingIP + this.config.apiURL + this.config.deviceID + "?key=" + this.config.apiKey;
        const self = this;

        const tempRequest = new XMLHttpRequest();
        tempRequest.open("GET", url, true);
        tempRequest.onreadystatechange = function () {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    self.processData(JSON.parse(this.response));
                } else {
                    Log.error(self.name + ": Could not load temperature.");
                }
            }
        };
        tempRequest.send();
    },

    processData: function (data) {
        const self = this;

        if (!data) {
            return;
        }

        this.currentTemp = (data.properties.currentTemperature * 9 / 5) + 32;
        this.currentHumidity = Math.round(data.properties.humidityPercent * 100) / 100;
        this.hvacMode = self.formatMode(data.properties.hvacMode);

        this.updateDom();
    },

    formatMode: function (mode) {
        switch (mode) {
            case "heatCool":
                return "Auto";
            case "cool":
                return "Cool";
            case "heat":
                return "Heat";
            case "off":
                return "Off";
        }
    }
});
