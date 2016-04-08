(function () {
    'use strict';

    var Chart,
        Controls,
        Tooltips,
        app,

        DATA_PATH = 'data.csv',

        START_YEAR = 1974,
        END_YEAR   = 2014,

        CIRCLE_RADIUS = 4,
        PRIMARY_COLOR = '#0476C7',
        HIGHLIGHT_COLORS = ['#E6C440', '#F43563'],
        SLIDER_WIDTH = 28,
        TRANSITION_DURATION = 300, // 18 frames
        SNAP_DURATION = 83, // 5 frames

        dollars = d3.format('$,d'),
        generation = function (born) {
            return born >= 1985 ? 'Millenial' :
                born >= 1965 ? 'Gen X' :
                born >= 1945 ? 'Boomer' :
                born >= 1925 ? 'Silent Generation' :
                'Greatest Generation';
        };

    Chart = function (el, owner, data, props) {
        this.el = el;
        this.owner = owner;
        this.data = d3.nest()
            .key(function (d) { return d.year - d.age; })
            .sortValues(function (a, b) { return a.year - b.year; })
            .entries(data);
        this.data.forEach(function (d) { d.keyInt = parseInt(d.key, 10); });
        this.lastProps = {};
        this.setup(props);
    };

    Chart.prototype = {
        setup: function (props) {
            var chart = this;

            chart.svg = d3.select(chart.el).append('svg');
            chart.canvas = d3.select(chart.el).append('canvas');

            chart.margin = { top: 15, right: 15, bottom: 30, left: 58 };

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
                .tickFormat(dollars);

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
            if (!forceRender &&
                props.year === chart.lastProps.year &&
                props.highlightedCohorts === chart.lastProps.highlightedCohorts)
            { return; }
            Object.assign(chart.lastProps, props);

            var rem = props.year % 1;

            chart.clearCanvas(ctx);

            drawCohorts(chart.data, PRIMARY_COLOR);

            props.highlightedCohorts.forEach(function (cohortYear, i) {
                if (!cohortYear) { return; }
                var series = chart.data.filter(function (d) { return d.keyInt === cohortYear; });
                drawCohorts(series, HIGHLIGHT_COLORS[i], true);
            });

            function drawCohorts(data, color, bold) {
                var i, j;

                ctx.fillStyle = color;
                ctx.strokeStyle = color;
                ctx.lineWidth = bold ? 2 : 1;

                for (i = 0; i < data.length; i++) {
                    var d = data[i];
                    var x, y;

                    ctx.globalAlpha = bold ? 1 : 0.33;
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

                        if (!bold && distance < 6) {
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
        }
    };

    Controls = function (el, owner, data, props) {
        this.$el = $(el);
        this.owner = owner;
        this.lastProps = {};
        this.setup(props);
    };

    Controls.prototype = {
        setup: function (props) {
            var controls = this;
            var owner = this.owner;

            function animationToggle(e) {
                if (!$(e.target).hasClass('disabled')) {
                    owner.toggleAnimation();
                }
            }

            this.$el.find('#animate').click(animationToggle);

            this.$el.find('#year-range').mousedown(function (e) {
                owner.setYear(START_YEAR + (END_YEAR - START_YEAR) * ((e.offsetX - SLIDER_WIDTH / 2) / (e.target.offsetWidth - SLIDER_WIDTH)));
                controls.rangeSliderActive = true;
            });
            this.$el.find('#year-range').mousemove(function (e) {
                if (controls.rangeSliderActive) { owner.setYear(parseFloat(e.target.value)); }
            });
            this.$el.find('#year-range').mouseup(function (e) {
                owner.setYear(Math.round(parseFloat(e.target.value)), true);
                controls.rangeSliderActive = false;
            });

            this.render(props);
        },

        render: function (props) {
            var updated = false;

            if (props.roundYear !== this.lastProps.roundYear) {
                this.$el.find('#year-label').text(props.roundYear);
                updated = true;
            }

            if (props.year !== this.lastProps.year) {
                if (!this.rangeSliderActive) { this.$el.find('#year-range').val(props.year); }
                updated = true;
            }

            if (props.animating !== this.lastProps.animating) {
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

            if (updated) { Object.assign(this.lastProps, props); }
        }
    };

    Tooltips = function (el, owner, data, props) {
        this.$el = $(el);
        this.owner = owner;
        this.data = data;
        this.lastProps = {};
        this.setup(props);
    };

    Tooltips.prototype = {
        setup: function (props) {
            var owner = this.owner;
            this.$el.find('button.clear').each(function (i) {
                $(this).click(function() { owner.removeHighlight(i); });
            });
            this.render(props);
        },

        render: function (props) {
            var tooltips = this;

            var yearChanged = props.roundYear !== tooltips.lastProps.roundYear;
            var cohortsChanged = props.highlightedCohorts !== tooltips.lastProps.highlightedCohorts;
            var indexChanged = props.highlightIndex !== tooltips.lastProps.highlightIndex;

            if (yearChanged) {
                tooltips.$el.find('.currentYear').text(props.roundYear);
                tooltips.lastProps.roundYear = props.roundYear;
            }

            if (cohortsChanged) {
                props.highlightedCohorts.map(function (d, i) {
                    if (!tooltips.lastProps.highlightedCohorts) { return true; }
                    return d !== tooltips.lastProps.highlightedCohorts[i];
                }).forEach(function (needsUpdate, i) {
                    if (!needsUpdate) { return; }

                    var tooltip = tooltips.$el.children(':nth-child(' + (i + 1) + ')');
                    var cohort = props.highlightedCohorts[i];

                    if (!cohort) {
                        tooltip.addClass('inactive');
                        tooltip.find('.cohort-data').text('');
                        return;
                    }

                    tooltip.removeClass('inactive');

                    var peakIncome = { income: 0 };

                    tooltips.data.forEach(function (d) {
                        if (d.year - d.age === cohort && d.income > peakIncome.income) {
                            peakIncome = d;
                        }
                    });

                    tooltip.find('.cohort').text(cohort);
                    tooltip.find('.generation').text(generation(cohort));
                    tooltip.find('.peakIncome').text(
                        dollars(peakIncome.income) +
                        ', age ' + peakIncome.age +
                        ', ' + peakIncome.year
                    );
                });

                tooltips.lastProps.highlightedCohorts = props.highlightedCohorts;
            }

            if (indexChanged) {
                tooltips.lastProps.highlightIndex = props.highlightIndex;
            }

            if (yearChanged || cohortsChanged) {
                tooltips.$el.find('.currentAge').each(function (i) {
                    var cohort = tooltips.lastProps.highlightedCohorts[i];
                    var year = tooltips.lastProps.roundYear;
                    if (!cohort || cohort > year) {
                        $(this).text('');
                    } else {
                        $(this).text(year - cohort);
                    }
                })
            }

            if (indexChanged || cohortsChanged) {
                var locked = tooltips.lastProps.highlightedCohorts.map(function (d, i) {
                    return d && tooltips.lastProps.highlightIndex !== i;
                });

                tooltips.$el.children().each(function (i) {
                    if (locked[i]) {
                        $(this).addClass('locked');
                    } else {
                        $(this).removeClass('locked');
                    }
                });
            }
        }
    };

    $(function () {
        d3.csv(DATA_PATH, app.initialize);
    });

    app = {
        data: [],
        components: {},

        globals: {
            live: false,
            animating: false,
            year: START_YEAR,
            roundYear: START_YEAR,
            highlightedCohorts: [null, null],
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
            app.components.tooltips = new Tooltips('#tooltips', app, app.data, app.globals);

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
                updatedProps.animating = app.activeTransitions.year &&
                    app.activeTransitions.year.duration > SNAP_DURATION ?
                    true : false;

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
                app.enqueueTransitions([{
                    key: 'year',
                    value: app.globals.roundYear,
                    transition: SNAP_DURATION
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

        setYear: function (year, smooth) {
            app.enqueueTransitions([{
                key: 'year',
                value: year,
                transition: smooth ? SNAP_DURATION : 0
            }]);
        },

        requestHighlightYear: function (age, lock) {
            if (app.globals.highlightIndex < 0) { return; }

            if (!lock || !app.globals.highlightedCohorts[app.globals.highlightIndex]) {
                var highlights = app.globals.highlightedCohorts.slice(0);
                highlights[app.globals.highlightIndex] = age ? app.globals.roundYear - age : null;

                app.enqueueTransitions([{ key: 'highlightedCohorts', value: highlights }]);
            }

            if (lock) {
                var index = app.globals.highlightedCohorts.indexOf(null);

                app.enqueueTransitions([{ key: 'highlightIndex', value: index }]);
            }
        },

        removeHighlight: function (idx) {
            var highlights = app.globals.highlightedCohorts.slice(0);
            highlights[idx] = null;

            var firstNull = highlights.indexOf(null);

            app.enqueueTransitions([
                { key: 'highlightedCohorts', value: highlights },
                { key: 'highlightIndex', value: firstNull }
            ]);
        }
    };
}());
