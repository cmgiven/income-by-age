(function () {
    'use strict';

    var Chart,
        Controls,
        app,

        DATA_PATH = 'data.csv',

        START_YEAR = 1974,
        END_YEAR   = 2014,

        TRANSITION_INTERVAL = 300,
        TRANSITION_DURATION = 300,
        TRANSITION_EASING   = 'linear';

    Chart = function (el) {
        this.setup(el, app.globals);
    };

    Chart.prototype = {
        state: {
            year: START_YEAR,
            highlightedCohort: null
        },

        setup: function (el, props) {
            var chart = this;

            chart.el = el;
            chart.svg = d3.select(el).append('svg');

            chart.margin = { top: 15, right: 15, bottom: 30, left: 60 };

            chart.body = chart.svg.append('g')
                .attr('transform', 'translate(' + chart.margin.left + ',' + chart.margin.top + ')');

            var ageExtent = d3.extent(app.data, function (d) { return d.age; });

            chart.scales = {
                x: d3.scale.linear()
                    .domain(ageExtent),
                y: d3.scale.linear()
                    .domain([0, d3.max(app.data, function (d) { return d.income; })])
            };

            chart.scales.resize = function () {
                chart.scales.x.range([0, chart.width]);
                chart.scales.y.range([chart.height, 0]);
            }

            chart.line = d3.svg.line()
                .x(function (d) { return chart.scales.x(d.age); })
                .y(function (d) { return chart.scales.y(d.income); });

            chart.layers = {
                bg: chart.body.append('g').attr('class', 'bg'),
                trails: chart.body.append('g').attr('class', 'trails'),
                cohorts: chart.body.append('g').attr('class', 'cohorts'),
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

            var ageRange = d3.range(ageExtent[0], ageExtent[1] + 1);

            chart.interactions = {
                ageRects: chart.layers.interaction.selectAll('.age-rects')
                    .data(ageRange)
                    .enter().append('rect')
                    .attr('class', 'age-rects')
                    .on('mouseover', function (d) { chart.highlight(d); })
                    .on('mouseout', function () { chart.highlight(0); })
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
                .attr('height', height)

            chart.width = width - chart.margin.left - chart.margin.right;
            chart.height = height - chart.margin.top - chart.margin.bottom;

            chart.scales.resize();
            chart.axes.resize();
            chart.interactions.resize();

            chart.update(props);
        },

        update: function (props) {
            var chart = this;

            var props = props || {};
            var animate = props.animate || props.year ? props.year > chart.state.year : false;
            var year = chart.state.year = props.year || chart.state.year;

            var duration = animate ? TRANSITION_DURATION : 0;

            var yearData = app.data.filter(function (d) { return d.year === year; });

            var cohorts = chart.layers.cohorts.selectAll('.cohort')
                .data(yearData, function (d) { return d.year - d.age; });

            cohorts.enter().append('circle')
                .attr('class', 'cohort')
                .attr('r', 2)
                .attr('cx', function (d) { return chart.scales.x(d.age); })
                .attr('cy', function (d) { return chart.scales.y(d.income); })
                .style('opacity', 0);

            cohorts.transition().duration(duration).ease(TRANSITION_EASING)
                .attr('cx', function (d) { return chart.scales.x(d.age); })
                .attr('cy', function (d) { return chart.scales.y(d.income); })
                .style('opacity', 1);

            cohorts.exit().transition().duration(duration).ease(TRANSITION_EASING)
                .style('opacity', 0)
                .remove();

            var trailData = app.data.filter(function (d) { return d.year >= year - 5 && d.year < year; });

            var trailLines = chart.layers.trails.selectAll('line.trail')
                .data(trailData, function (d) { return d.year + '-' + d.age; });

            trailLines.enter().append('line')
                .attr('class', 'cohort trail')
                .attr('x2', function (d) { return chart.scales.x(d.age) })
                .attr('y2', function (d) { return chart.scales.y(d.income) });

            trailLines
                .attr('x1', function (d) { return chart.scales.x(d.age) })
                .attr('y1', function (d) { return chart.scales.y(d.income) });

            var nextYear;

            trailLines.transition().duration(duration).ease(TRANSITION_EASING)
                .attr('x2', function (d) {
                    var nextYear = app.data.filter(function (e) { return e.year === d.year + 1 && e.age === d.age + 1; })[0];
                    if (nextYear) {
                        return chart.scales.x(nextYear.age);
                    } else {
                        return chart.scales.x(d.age);
                    }
                })
                .attr('y2', function (d) {
                    var nextYear = app.data.filter(function (e) { return e.year === d.year + 1 && e.age === d.age + 1; })[0];
                    if (nextYear) {
                        return chart.scales.y(nextYear.income);
                    } else {
                        return chart.scales.y(d.income);
                    }
                })
                .style('opacity', function (d) { return (6 + d.year - year) / 5; });

            trailLines.exit().remove();

            var oldData = app.data.filter(function (d) { return d.year <= year - 5; });
            var nestedOldData = d3.nest()
                .key(function (d) { return d.year - d.age; })
                .entries(oldData);

            var trailPaths = chart.layers.trails.selectAll('path.trail')
                .data(nestedOldData, function (d) { return d.key; });

            trailPaths.enter().append('path')
                .attr('class', 'cohort trail');

            trailPaths
                .attr('d', function (d) { return chart.line(d.values); });

            trailPaths.exit().remove();

            chart.highlight();
        },

        highlight: function (age) {
            var chart = this;

            chart.state.highlightedCohort = age ? chart.state.year - age :
                age === 0 ? null : chart.state.highlightedCohort;

            function isHighlighted(d) {
                if (!chart.state.highlightedCohort) { return false; }
                return d.year - d.age === chart.state.highlightedCohort ||
                    d.key === '' + chart.state.highlightedCohort;
            }

            chart.svg.selectAll('.cohort')
                .classed('highlighted', isHighlighted);

            var trailData = app.data.filter(function (d) {
                return d.year < chart.state.year && d.year - d.age === chart.state.highlightedCohort;
            });

            var trail = chart.layers.interaction.selectAll('.trail')
                .data([trailData]);

            trail.enter().append('path')
                .attr('class', 'trail highlighted');

            trail.attr('d', chart.line);

            trail.exit().remove();
        }
    };

    Controls = function (el) {
        this.$el = $(el);

        this.setup();
        this.$el.find('#year-label').text(app.globals.year);
        this.setAnimationState(app.globals.animating);
    };

    Controls.prototype = {
        setup: function () {
            function animationToggle(e) {
                if (!$(e.target).hasClass('disabled')) {
                    app.toggleAnimation();
                }
            }

            this.$el.find('#animate').click(animationToggle);
        },

        update: function (props) {
            var year = props.year;
            var yearLabel = this.$el.find('#year-label');

            setTimeout(function() { yearLabel.text(year); }, TRANSITION_DURATION / 2);
        },

        setAnimationState: function (animating) {
            var toggle = this.$el.find('#animate');

            if (animating) {
                toggle.removeClass('paused');
                toggle.addClass('playing');
            } else {
                toggle.removeClass('playing');
                toggle.addClass('paused');
            }
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
            availableYears: d3.range(START_YEAR, END_YEAR + 1),
            year: START_YEAR,
            animating: false
        },

        initialize: function (data) {
            app.data = data.map(function (d) {
                return {
                    year: parseInt(d.year, 10),
                    age: parseInt(d.age, 10),
                    income: parseInt(d.income, 10)
                };
            });

            app.components.chart    = new Chart('#chart');
            app.components.controls = new Controls('#controls');

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

            // Let's move!
            app.toggleAnimation();
        },

        resize: function () {
            for (var component in app.components) {
                if (app.components[component].resize) {
                    app.components[component].resize();
                }
            }
        },

        setYear: function (year) {
            app.globals.year = year;
            for (var component in app.components) {
                if (app.components[component].update) {
                    app.components[component].update(app.globals);
                }
            }
        },

        toggleAnimation: function (disable) {
            var startTime = null;

            function frame(time) {
                if (app.globals.animating) {
                    if (!startTime) {
                        var availableYears = app.globals.availableYears;
                        var currentIdx = availableYears.indexOf(app.globals.year);
                        app.setYear(availableYears[(currentIdx + 1) % availableYears.length]);
                        if (app.globals.year === END_YEAR) { app.toggleAnimation(true); }
                        startTime = time;
                    }

                    var progress = time - startTime;

                    if (progress <= TRANSITION_INTERVAL) {
                        window.requestAnimationFrame(frame);
                    } else {
                        startTime = null;
                        window.requestAnimationFrame(frame);
                    }
                }
            }

            if (app.globals.animating || disable) {
                app.globals.animating = false;
                $('body').removeClass('animating');
                if (app.components.controls.setAnimationState) {
                    app.components.controls.setAnimationState(false);
                }
            } else {
                app.globals.animating = true;
                window.requestAnimationFrame(frame);
                $('body').addClass('animating');
                if (app.components.controls.setAnimationState) {
                    app.components.controls.setAnimationState(true);
                }
            }
        }
    };
}());
