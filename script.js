(function () {
    'use strict';

    var Chart,
        Controls,
        app,

        DATA_PATH = 'data.csv',

        START_YEAR = 1974,
        END_YEAR   = 2014,

        CIRCLE_RADIUS = 4,
        TRANSITION_DURATION = 300;

    Chart = function (el, owner, data, props) {
        this.el = el;
        this.owner = owner;
        this.data = d3.nest()
            .key(function (d) { return d.year - d.age; })
            .sortValues(function (a, b) { return a.year - b.year; })
            .entries(data);
        this.data.forEach(function (d) { d.keyInt = parseInt(d.key, 10); });
        this.setup(props);
    };

    Chart.prototype = {
        setup: function (props) {
            var chart = this;

            chart.svg = d3.select(chart.el).append('svg');
            chart.canvas = d3.select(chart.el).append('canvas');

            chart.margin = { top: 15, right: 15, bottom: 30, left: 60 };

            chart.body = chart.svg.append('g')
                .attr('transform', 'translate(' + chart.margin.left + ',' + chart.margin.top + ')');

            chart.ageExtent = d3.extent(app.data, function (d) { return d.age; });

            chart.scales = {
                x: d3.scale.linear()
                    .domain(chart.ageExtent),
                y: d3.scale.linear()
                    .domain([0, d3.max(app.data, function (d) { return d.income; })])
            };

            chart.scales.resize = function () {
                chart.scales.x.range([0, chart.width]);
                chart.scales.y.range([chart.height, 0]);
            }

            chart.layers = {
                bg: chart.body.append('g').attr('class', 'bg'),
                interaction: chart.body.append('g').attr('class', 'interaction')
            }

            var xAxis = d3.svg.axis()
                .scale(chart.scales.x)
                .orient('bottom');

            var yAxis = d3.svg.axis()
                .scale(chart.scales.y)
                .orient('left')
                .tickFormat(d3.format('$,d'));

            chart.axes = {
                x: chart.layers.bg.append('g')
                    .attr('class', 'x axis'),
                y: chart.layers.bg.append('g')
                    .attr('class', 'y axis')
            };

            chart.axes.resize = function () {
                yAxis.tickSize(-chart.width);

                chart.axes.x
                    .attr('transform', 'translate(0,' + chart.height + ')')
                    .call(xAxis);
                chart.axes.y
                    .call(yAxis);
            };

            var ageRange = d3.range(chart.ageExtent[0], chart.ageExtent[1] + 1);

            chart.interactions = {
                ageRects: chart.layers.interaction.selectAll('.age-rects')
                    .data(ageRange)
                    .enter().append('rect')
                    .attr('class', 'age-rects')
                    .on('mouseover', function (d) { chart.owner.requestHighlightYear(d); })
                    .on('mouseout', function () { chart.owner.requestHighlightYear(0); })
                    .on('click', function (d) { chart.owner.requestHighlightYear(d, true); })
            };

            chart.interactions.resize = function () {
                var bandWidth = chart.scales.x(ageRange[1]) - chart.scales.x(ageRange[0]);

                chart.interactions.ageRects
                    .attr('x', function (d) { return chart.scales.x(d) - bandWidth / 2; })
                    .attr('y', 0)
                    .attr('width', bandWidth)
                    .attr('height', chart.height )
            };

            chart.resize(props);
        },

        resize: function (props) {
            var chart = this;

            var $el = $(chart.el);
            var width = $el.width();
            var height = $el.height();

            chart.svg
                .attr('width', width)
                .attr('height', height);

            chart.canvas
                .attr('width', width)
                .attr('height', height);

            chart.context = chart.canvas.node().getContext('2d');
            chart.context.translate(chart.margin.left, chart.margin.top);

            chart.clearCanvas = function (ctx) {
                ctx.clearRect(0 - chart.margin.left, 0 - chart.margin.top, width, height);
            }

            chart.width = width - chart.margin.left - chart.margin.right;
            chart.height = height - chart.margin.top - chart.margin.bottom;

            chart.scales.resize();
            chart.axes.resize();
            chart.interactions.resize();

            chart.render(props, true);
        },

        render: function (props, forceRender) {
            var chart = this;
            var ctx = chart.context;

            props = props || chart.lastProps;
            if (!forceRender && chart.lastProps &&
                props.year === chart.lastProps.year &&
                props.highlightedCohorts === chart.lastProps.highlightedCohorts)
            { return; }
            chart.lastProps = props;

            chart.clearCanvas(ctx);
            ctx.fillStyle = 'rgb(4,118,199)';
            ctx.strokeStyle = 'rgb(4,118,199)';

            var rem = props.year % 1;
            var i, j;

            for (i = 0; i < chart.data.length; i++) {
                var d = chart.data[i];
                var x, y;

                ctx.globalAlpha = .33;
                ctx.beginPath();

                for (j = 0; j < d.values.length; j++) {
                    var e = d.values[j];

                    if (e.year >= props.year + 1) { break; }

                    if (e.year <= props.year || j === 0) {
                        x = chart.scales.x(e.age);
                        y = chart.scales.y(e.income);
                    } else {
                        x += (chart.scales.x(e.age) - x) * rem;
                        y += (chart.scales.y(e.income) - y) * rem;
                    }

                    if (j === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }

                    var distance = props.year - e.year;

                    if (distance < 6) {
                        ctx.stroke();
                        ctx.globalAlpha = 1 - distance / 9;
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                    }
                }

                ctx.stroke();

                var deltaEnd = props.year - d.keyInt - chart.ageExtent[1];
                var deltaStart = props.year - d.keyInt - chart.ageExtent[0];

                if (deltaStart > -1 && deltaEnd < 1) {
                    ctx.globalAlpha = deltaStart < 0 ? rem : deltaEnd > 0 ? 1 - rem : 1;
                    ctx.beginPath();
                    ctx.arc(x, y, CIRCLE_RADIUS, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
    };

    Controls = function (el, owner, data, props) {
        this.$el = $(el);
        this.owner = owner;
        this.setup(props);
    };

    Controls.prototype = {
        setup: function (props) {
            var owner = this.owner;

            function animationToggle(e) {
                if (!$(e.target).hasClass('disabled')) {
                    owner.toggleAnimation();
                }
            }

            this.$el.find('#animate').click(animationToggle);

            this.render(props);
        },

        render: function (props) {
            var updated = false;

            if (!this.lastProps || props.roundYear !== this.lastProps.roundYear) {
                this.$el.find('#year-label').text(props.roundYear);
                updated = true;
            }

            if (!this.lastProps || props.animating !== this.lastProps.animating) {
                var toggle = this.$el.find('#animate');

                if (props.animating) {
                    toggle.removeClass('paused');
                    toggle.addClass('playing');
                } else {
                    toggle.removeClass('playing');
                    toggle.addClass('paused');
                }

                updated = true;
            }

            if (updated) { this.lastProps = props; }
        }
    };

    $(function () {
        d3.csv(DATA_PATH, app.initialize);
    });

    app = {
        data: [],
        components: {
            controls: {},
            chart: {}
        },

        globals: {
            live: false,
            animating: false,
            year: START_YEAR,
            roundYear: START_YEAR,
            highlightedCohorts: [],
            highlightIndex: 0
        },

        transitionQueue: [],
        activeTransitions: {},

        initialize: function (data) {
            app.data = data.map(function (d) {
                return {
                    year: parseInt(d.year, 10),
                    age: parseInt(d.age, 10),
                    income: parseInt(d.income, 10)
                };
            });

            app.components.chart    = new Chart('#chart', app, app.data, app.globals);
            app.components.controls = new Controls('#controls', app, null, app.globals);

            $(window).resize(app.resize);

            $(window).keydown(function (e) {
                switch (e.which) {
                case 32: // space
                    app.toggleAnimation();
                    break;

                default:
                    return;
                }

                e.preventDefault();
            });

            $('#loading').fadeOut();
            $('#main').fadeIn();

            app.resize();
            app.toggleAnimation();
        },

        resize: function () {
            for (var component in app.components) {
                if (app.components[component].resize) {
                    app.components[component].resize();
                }
            }
        },

        render: function (props) {
            for (var component in app.components) {
                if (app.components[component].render) {
                    app.components[component].render(props);
                }
            }
        },

        animationFrame: function (time) {
            var updatedProps = {};

            while (app.transitionQueue.length) {
                var update = app.transitionQueue.shift();

                if (update.transition === 0) {
                    updatedProps[update.key] = update.value;
                    if (app.activeTransitions[update.key]) {
                        delete app.activeTransitions[update.key];
                    }
                } else {
                    var originalValue = updatedProps[update.key] || app.globals[update.key];

                    app.activeTransitions[update.key] = {
                        value: update.value,
                        distance: originalValue - update.value,
                        duration: update.transition,
                        start: time
                    };
                }
            }

            for (var property in app.activeTransitions) {
                var transition = app.activeTransitions[property];
                var remaining = time === transition.start ? 1 :
                    Math.max(1 - (time - transition.start) / transition.duration, 0);

                updatedProps[property] = transition.value + (transition.distance * remaining);

                if (remaining === 0) { delete app.activeTransitions[property]; }
            }

            if (Object.keys(updatedProps).length) {
                if (updatedProps.year) { updatedProps.roundYear = Math.round(updatedProps.year); }
                updatedProps.animating = app.activeTransitions.year ? true : false;

                app.globals = Object.assign({}, app.globals, updatedProps);
                app.render(app.globals);

                window.requestAnimationFrame(app.animationFrame);
            } else {
                app.globals.live = false;
            }
        },

        enqueueTransitions: function (arr) {
            arr.forEach(function (prop) {
                app.transitionQueue.push({
                    key: prop.key,
                    value: prop.value,
                    transition: prop.transition || 0
                });
            });

            if (!app.globals.live) {
                app.globals.live = true;
                window.requestAnimationFrame(app.animationFrame);
            }
        },

        toggleAnimation: function () {
            var currentYear = app.globals.year;

            if (app.globals.animating) {
                var roundYear = app.globals.roundYear;

                app.enqueueTransitions([{
                    key: 'year',
                    value: roundYear,
                    transition: Math.abs(roundYear - currentYear) * TRANSITION_DURATION / 2
                }]);
            } else {
                var transitions = [];

                if (currentYear === END_YEAR) {
                    transitions.push({ key: 'year', value: START_YEAR });
                    currentYear = START_YEAR;
                }

                transitions.push({
                    key: 'year',
                    value: END_YEAR,
                    transition: (END_YEAR - currentYear) * TRANSITION_DURATION
                });

                app.enqueueTransitions(transitions);
            }
        },

        requestHighlightYear: function (year, lock) {
            //
        }
    };
}());
