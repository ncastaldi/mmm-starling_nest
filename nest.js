/* eslint-disable prettier/prettier */
var thermostatDial = (function () {

    /*
     * Utility functions
     */

    // Create an element with proper SVG namespace, optionally setting its attributes and appending it to another element
    function createSVGElement(tag, attributes, appendTo) {
        var element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        attr(element, attributes);
        if (appendTo) {
            appendTo.appendChild(element);
        }
        return element;
    }

    // Set attributes for an element
    function attr(element, attrs) {
        for (var i in attrs) {
            element.setAttribute(i, attrs[i]);
        }
    }

    // Rotate a cartesian point about given origin by X degrees
    function rotatePoint(point, angle, origin) {
        var radians = angle * Math.PI / 180;
        var x = point[0] - origin[0];
        var y = point[1] - origin[1];
        var x1 = x * Math.cos(radians) - y * Math.sin(radians) + origin[0];
        var y1 = x * Math.sin(radians) + y * Math.cos(radians) + origin[1];
        return [x1, y1];
    }

    // Rotate an array of cartesian points about a given origin by X degrees
    function rotatePoints(points, angle, origin) {
        return points.map(function (point) {
            return rotatePoint(point, angle, origin);
        });
    }

    // Given an array of points, return an SVG path string representing the shape they define
    function pointsToPath(points) {
        return points.map(function (point, iPoint) {
            return (iPoint > 0 ? 'L' : 'M') + point[0] + ' ' + point[1];
        }).join(' ') + 'Z';
    }

    function circleToPath(cx, cy, r) {
        return [
            "M", cx, ",", cy,
            "m", 0 - r, ",", 0,
            "a", r, ",", r, 0, 1, ",", 0, r * 2, ",", 0,
            "a", r, ",", r, 0, 1, ",", 0, 0 - r * 2, ",", 0,
            "z"
        ].join(' ').replace(/\s,\s/g, ",");
    }

    function donutPath(cx, cy, rOuter, rInner) {
        return circleToPath(cx, cy, rOuter) + " " + circleToPath(cx, cy, rInner);
    }

    // Restrict a number to a min + max range
    function restrictToRange(val, min, max) {
        if (val < min) return min;
        if (val > max) return max;
        return val;
    }

    // Round a number to the nearest 0.5
    function roundHalf(num) {
        return Math.round(num * 2) / 2;
    }

    function setClass(el, className, state) {
        el.classList[state ? 'add' : 'remove'](className);
    }

    /*
     * The "MEAT"
     */

    return function (targetElement, options) {
        var self = this;

        var diameter = 400;
        var ticks = 150;
        var offset = 20;

        if (options.size === 'medium') {
            diameter = 300;
            ticks = 110;
            offset = 15;
        }

        if (options.size === 'small') {
            diameter = 200;
            ticks = 75;
            offset = 10;
        }

        if (options.size === 'mini') {
            diameter = 100;
            ticks = 38;
            offset = 5;
        }

        /*
         * Options
         */
        options = options || {};
        options = {
            temperature_scale: 'F',
            size: options.size || 'large',
            diameter: diameter,
            minValue: (options.temperature_scale === 'F') ? 50 : 10,
            maxValue: (options.temperature_scale === 'F') ? 90 : 30,
            numTicks: ticks,
            onSetTargetTemperature: options.onSetTargetTemperature || function () { }, // Function called when new target temperature set by the dial
        };

        /*
         * Properties - calculated from options in many cases
         */
        var properties = {
            tickDegrees: 300, //  Degrees of the dial that should be covered in tick lines
            rangeValue: options.maxValue - options.minValue,
            radius: options.diameter / 2,
            ticksOuterRadius: options.diameter / 30,
            ticksInnerRadius: options.diameter / 8,
            hvac_states: ['off', 'heating', 'cooling'],
            dragLockAxisDistance: 15,
        };

        properties.lblAmbientPosition = [properties.radius, properties.ticksOuterRadius - (properties.ticksOuterRadius - properties.ticksInnerRadius) / 2]
        properties.offsetDegrees = 180 - (360 - properties.tickDegrees) / 2;

        /*
         * Object state
         */
        var state = {
            target_temperature: options.minValue,
            ambient_temperature: options.minValue,
            hvac_state: properties.hvac_states[0],
            has_leaf: false,
            away: false
        };

        /*
         * Property getter / setters
         */
        Object.defineProperty(this, 'target_temperature', {
            get: function () {
                return state.target_temperature;
            },
            set: function (val) {
                state.target_temperature = restrictTargetTemperature(+val);
                render();
            }
        });

        Object.defineProperty(this, 'ambient_temperature', {
            get: function () {
                return state.ambient_temperature;
            },
            set: function (val) {
                state.ambient_temperature = roundHalf(+val);
                render();
            }
        });

        Object.defineProperty(this, 'hvac_state', {
            get: function () {
                return state.hvac_state;
            },
            set: function (val) {
                if (properties.hvac_states.indexOf(val) >= 0) {
                    state.hvac_state = val;
                    render();
                }
            }
        });

        Object.defineProperty(this, 'has_leaf', {
            get: function () {
                return state.has_leaf;
            },
            set: function (val) {
                state.has_leaf = !!val;
                render();
            }
        });

        Object.defineProperty(this, 'away', {
            get: function () {
                return state.away;
            },
            set: function (val) {
                state.away = !!val;
                render();
            }
        });

        /*
         * SVG
         */
        var svg = createSVGElement('svg', {
            width: options.diameter + 'px',
            height: options.diameter + 'px',
            viewBox: '0 0 ' + options.diameter + ' ' + options.diameter,
            class: 'dial'
        }, targetElement);

        // CIRCULAR DIAL
        var circle = createSVGElement('circle', {
            cx: properties.radius,
            cy: properties.radius,
            r: properties.radius,
            class: 'dial__shape'
        }, svg);

        // EDITABLE INDICATOR
        var editCircle = createSVGElement('path', {
            d: donutPath(properties.radius, properties.radius, properties.radius - 4, properties.radius - 8),
            class: 'dial__editableIndicator',
        }, svg);

        /*
         * Ticks
         */
        var ticks = createSVGElement('g', {
            class: 'dial__ticks'
        }, svg);

        var tickPoints = [
            [properties.radius - 1, properties.ticksOuterRadius],
            [properties.radius + 1, properties.ticksOuterRadius],
            [properties.radius + 1, properties.ticksInnerRadius],
            [properties.radius - 1, properties.ticksInnerRadius]
        ];

        var tickPointsLarge = [
            [properties.radius - 1.5, properties.ticksOuterRadius],
            [properties.radius + 1.5, properties.ticksOuterRadius],
            [properties.radius + 1.5, properties.ticksInnerRadius + offset],
            [properties.radius - 1.5, properties.ticksInnerRadius + offset]
        ];

        var theta = properties.tickDegrees / options.numTicks;
        var tickArray = [];
        for (var iTick = 0; iTick < options.numTicks; iTick++) {
            tickArray.push(createSVGElement('path', { d: pointsToPath(tickPoints) }, ticks));
        };

        /*
         * Labels
         */
        var lblTarget = createSVGElement('text', {
            x: properties.radius,
            y: properties.radius,
            class: 'dial__lbl dial__lbl--target dial__' + options.size
        }, svg);

        var lblTarget_text = document.createTextNode('');
        lblTarget.appendChild(lblTarget_text);

        /*
         * Name
         */
        var lblName = createSVGElement('text', {
            x: properties.radius,
            y: properties.radius * 1.4,
            class: 'dial__lbl dial__lbl--name dial__' + options.size
        }, svg);

        var lblTarget_name = document.createTextNode('');
        lblName.appendChild(lblTarget_name);

        //
        var lblTargetHalf = createSVGElement('text', {
            x: properties.radius + properties.radius / 2.5,
            y: properties.radius - properties.radius / 8,
            class: 'dial__lbl dial__lbl--target--half dial__' + options.size
        }, svg);

        var lblTargetHalf_text = document.createTextNode('5');
        lblTargetHalf.appendChild(lblTargetHalf_text);

        //
        var lblAmbient = createSVGElement('text', {
            class: 'dial__lbl dial__lbl--ambient dial__' + options.size
        }, svg);

        var lblAmbient_text = document.createTextNode('');
        lblAmbient.appendChild(lblAmbient_text);

        //
        var lblAway = createSVGElement('text', {
            x: properties.radius,
            y: properties.radius,
            class: 'dial__lbl dial__lbl--away dial__' + options.size
        }, svg);

        var lblAway_text = document.createTextNode('AWAY');
        lblAway.appendChild(lblAway_text);

        //
        var icoLeaf = createSVGElement('path', {
            class: 'dial__ico__leaf'
        }, svg);

        /*
         * LEAF
         */
        var leafScale = properties.radius / 5 / 100;
        var leafDef = ["M", 3, 84, "c", 24, 17, 51, 18, 73, -6, "C", 100, 52, 100, 22, 100, 4, "c", -13, 15, -37, 9, -70, 19, "C", 4, 32, 0, 63, 0, 76, "c", 6, -7, 18, -17, 33, -23, 24, -9, 34, -9, 48, -20, -9, 10, -20, 16, -43, 24, "C", 22, 63, 8, 78, 3, 84, "z"].map(function (x) {
            return isNaN(x) ? x : x * leafScale;
        }).join(' ');

        var translate = [properties.radius - (leafScale * 100 * 0.5), properties.radius * 1.5]
        var icoLeaf = createSVGElement('path', {
            class: 'dial__ico__leaf',
            d: leafDef,
            transform: 'translate(' + translate[0] + ',' + translate[1] + ')'
        }, svg);

        /*
         * RENDER
         */
        function render() {
            renderName();
            renderHvacState();
            renderTicks();
            renderTargetTemperature();
            renderAmbientTemperature();
            renderLeaf();
        }

        render();

        /*
         * RENDER - ticks
         */
        function renderTicks() {
            var vMin, vMax;
            if (self.away) {
                vMin = self.ambient_temperature;
                vMax = vMin;
            } else {
                vMin = Math.min(self.ambient_temperature, self.target_temperature);
                vMax = Math.max(self.ambient_temperature, self.target_temperature);
            }

            var min = restrictToRange(Math.round((vMin - options.minValue) / properties.rangeValue * options.numTicks), 0, options.numTicks - 1);
            var max = restrictToRange(Math.round((vMax - options.minValue) / properties.rangeValue * options.numTicks), 0, options.numTicks - 1);

            //
            tickArray.forEach(function (tick, iTick) {
                var isLarge = iTick == min || iTick == max;
                var isActive = iTick >= min && iTick <= max;
                attr(tick, {
                    d: pointsToPath(
                        rotatePoints(
                            isLarge
                                ? tickPointsLarge
                                : tickPoints,
                            iTick * theta - properties.offsetDegrees,
                            [properties.radius, properties.radius])),
                    class: isActive ? 'active' : ''
                });
            });
        }

        /*
         * RENDER - ambient temperature
         */
        function renderAmbientTemperature() {
            lblAmbient_text.nodeValue = Math.floor(self.ambient_temperature);
            if (self.ambient_temperature % 1 != 0) {
                lblAmbient_text.nodeValue += '⁵';
            }

            var peggedValue = restrictToRange(self.ambient_temperature, options.minValue, options.maxValue);
            degs = properties.tickDegrees * (peggedValue - options.minValue) / properties.rangeValue - properties.offsetDegrees;

            if (peggedValue > self.target_temperature) {
                degs += 8;
            } else {
                degs -= 8;
            }

            var pos = rotatePoint(properties.lblAmbientPosition, degs, [properties.radius, properties.radius]);
            attr(lblAmbient, {
                x: pos[0],
                y: pos[1] + 3
            });
        }

        /*
         * RENDER - target temperature
         */
        function renderTargetTemperature() {
            lblTarget_text.nodeValue = Math.floor(self.target_temperature);
            setClass(lblTargetHalf, 'shown', self.target_temperature % 1 != 0);
        }

        /*
         * RENDER - leaf
         */
        function renderLeaf() {
            setClass(svg, 'has-leaf', self.has_leaf);
        }

        /*
         * RENDER - HVAC state
         */
        function renderHvacState() {
            Array.prototype.slice.call(svg.classList).forEach(function (c) {
                if (c.match(/^dial--state--/)) {
                    svg.classList.remove(c);
                };
            });
            svg.classList.add('dial--state--' + self.hvac_state);
        }

        /*
         * RENDER - awau
         */
        function renderName() {
            lblTarget_name.nodeValue = self.where_name;
        }

        /*
         * Helper functions
         */
        function restrictTargetTemperature(t) {
            return restrictToRange(roundHalf(t), options.minValue, options.maxValue);
        }

        function angle(point) {
            var dx = point[0] - properties.radius;
            var dy = point[1] - properties.radius;
            var theta = Math.atan(dx / dy) / (Math.PI / 180);
            if (point[0] >= properties.radius && point[1] < properties.radius) {
                theta = 90 - theta - 90;
            } else if (point[0] >= properties.radius && point[1] >= properties.radius) {
                theta = 90 - theta + 90;
            } else if (point[0] < properties.radius && point[1] >= properties.radius) {
                theta = 90 - theta + 90;
            } else if (point[0] < properties.radius && point[1] < properties.radius) {
                theta = 90 - theta + 270;
            }
            return theta;
        };
    };
})();

var getTemp = function (config, callback) {
    if (!config || !config.token) {
        return callback({ success: false, message: 'Please run getNestToken.sh and put your token in the config.js file', data: null });
    }

    console.log('CONFIG: ', config);

    var url = 'https://developer-api.nest.com/devices?auth=' + config.token;
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.onreadystatechange = function () {
        if (this.readyState === 4) {
            if (this.status === 200) {
                if (this.response == '{}') {
                    return callback({ success: true, message: 'Token works, but no data received. Make sure you are using the master account.', data: null });
                } else {
                    var data = JSON.parse(this.response);

                    console.log('NEST DATA: ', data);

                    if (!data.thermostats || JSON.stringify(data.thermostats) === '{}') {
                        return callback({ success: true, message: 'No Thermostats.', data: null });
                    }

                    var thermostats = [];

                    for (var thermostat in data.thermostats) {
                        if (!data.thermostats.hasOwnProperty(thermostat)) {
                            continue;
                        }

                        var therm = data.thermostats[thermostat];

                        if (!config.onlineOnly || (config.onlineOnly && therm.is_online)) {
                            if (!config.whereFilter || (typeof config.whereFilter === 'object' && config.whereFilter.length > 0 && config.whereFilter.indexOf(therm.where_name) > -1)) {
                                thermostats.push({
                                    where_name: therm.where_name,
                                    temperature_scale: therm.temperature_scale,
                                    has_leaf: therm.has_leaf,
                                    hvac_state: therm.hvac_state,
                                    target_temperature: (therm.temperature_scale === 'F') ? therm.target_temperature_f : therm.target_temperature_c,
                                    ambient_temperature: (therm.temperature_scale === 'F') ? therm.ambient_temperature_f : therm.ambient_temperature_c
                                });
                            }
                        }
                    }

                    return callback({ success: true, message: null, data: thermostats });
                }
            } else {
                return callback({ success: false, message: 'Nest Error - Status: ' + this.status, data: null })
            }
        }
    };
    req.send();
}