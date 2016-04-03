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
        this.setup(el);
        this.update(app.globals);
    };

    Chart.prototype = {
        state: {
            year: START_YEAR,
            highlightedCohort: null
        },

        setup: function (el) {
            var chart = this;

            var width = 600;
            var height = 400;

            var margin = {
                top: 15, right: 15, bottom: 30, left: 60
            };

            chart.svg = d3.select(el)
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            width = width - margin.left - margin.right;
            height = height - margin.top - margin.bottom;

            var ageExtent = d3.extent(app.data, function (d) { return d.age; });

            chart.x = d3.scale.linear()
                .domain(ageExtent)
                .range([0, width]);

            chart.y = d3.scale.linear()
                .domain([0, d3.max(app.data, function (d) { return d.income; })])
                .range([height, 0]);

            chart.line = d3.svg.line()
                .x(function (d) { return chart.x(d.age); })
                .y(function (d) { return chart.y(d.income); });

            var xAxis = d3.svg.axis()
                .scale(chart.x)
                .orient('bottom');

            var yAxis = d3.svg.axis()
                .scale(chart.y)
                .orient('left')
                .tickSize(-width)
                .tickFormat(d3.format('$,d'));

            chart.svg.append('g')
                .attr('class', 'x axis')
                .attr('transform', 'translate(0,' + height + ')')
                .call(xAxis);

            chart.svg.append('g')
                .attr('class', 'y axis')
                .call(yAxis);

            chart.layers = {
                trails: chart.svg.append('g'),
                cohorts: chart.svg.append('g'),
                interaction: chart.svg.append('g').attr('class', 'interaction')
            }

            var ageRects = chart.layers.interaction.selectAll('.age-rects')
                .data(d3.range(ageExtent[0], ageExtent[1]));

            ageRects.enter().append('rect')
                .attr('class', 'age-rects')
                .attr('x', function (d) { return chart.x(d); })
                .attr('y', 0)
                .attr('width', function (d) { return chart.x(d + 1) - chart.x(d); })
                .attr('height', height )
                .on('mouseover', function (d) { chart.highlight(d); })
                .on('mouseout', function () { chart.highlight(null); });;
        },

        update: function (props) {
            var chart = this;

            var year = chart.state.year = props.year;

            var yearData = app.data.filter(function (d) { return d.year === year; });

            var cohorts = chart.layers.cohorts.selectAll('.cohort')
                .data(yearData, function (d) { return d.year - d.age; });

            cohorts.enter().append('circle')
                .attr('class', 'cohort')
                .attr('r', 2)
                .attr('cx', function (d) { return chart.x(d.age); })
                .attr('cy', function (d) { return chart.y(d.income); })
                .style('opacity', 0);

            cohorts.transition().duration(TRANSITION_DURATION).ease(TRANSITION_EASING)
                .attr('cx', function (d) { return chart.x(d.age); })
                .attr('cy', function (d) { return chart.y(d.income); })
                .style('opacity', 1);

            cohorts.exit().transition().duration(TRANSITION_DURATION).ease(TRANSITION_EASING)
                .style('opacity', 0)
                .remove();

            var trailData = app.data.filter(function (d) { return d.year >= year - 5 && d.year < year; });

            var trailLines = chart.layers.trails.selectAll('line.trail')
                .data(trailData, function (d) { return d.year + '-' + d.age; });

            trailLines.enter().append('line')
                .attr('class', 'cohort trail')
                .attr('x1', function (d) { return chart.x(d.age) })
                .attr('y1', function (d) { return chart.y(d.income) })
                .attr('x2', function (d) { return chart.x(d.age) })
                .attr('y2', function (d) { return chart.y(d.income) });

            var nextYear;

            trailLines.transition().duration(TRANSITION_DURATION).ease(TRANSITION_EASING)
                .attr('x2', function (d) {
                    var nextYear = app.data.filter(function (e) { return e.year === d.year + 1 && e.age === d.age + 1; })[0];
                    if (nextYear) {
                        return chart.x(nextYear.age);
                    } else {
                        return chart.x(d.age);
                    }
                })
                .attr('y2', function (d) {
                    var nextYear = app.data.filter(function (e) { return e.year === d.year + 1 && e.age === d.age + 1; })[0];
                    if (nextYear) {
                        return chart.y(nextYear.income);
                    } else {
                        return chart.y(d.income);
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

            chart.state.highlightedCohort = chart.state.year - age || chart.state.highlightedCohort;

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

            trail.exit().remove()
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
