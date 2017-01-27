'use strict';

System.register(['angular', 'jquery', 'moment', 'lodash', 'app/core/utils/kbn', './histogram_tooltip.js', 'jquery.flot', 'jquery.flot.selection', 'jquery.flot.time', 'jquery.flot.stack', 'jquery.flot.stackpercent', 'jquery.flot.fillbelow', 'jquery.flot.crosshair', 'app/plugins/panel/graph/jquery.flot.events'], function (_export, _context) {
  "use strict";

  var angular, $, moment, _, kbn, HistogramTooltip;

  return {
    setters: [function (_angular) {
      angular = _angular.default;
    }, function (_jquery) {
      $ = _jquery.default;
    }, function (_moment) {
      moment = _moment.default;
    }, function (_lodash) {
      _ = _lodash.default;
    }, function (_appCoreUtilsKbn) {
      kbn = _appCoreUtilsKbn.default;
    }, function (_histogram_tooltipJs) {
      HistogramTooltip = _histogram_tooltipJs.default;
    }, function (_jqueryFlot) {}, function (_jqueryFlotSelection) {}, function (_jqueryFlotTime) {}, function (_jqueryFlotStack) {}, function (_jqueryFlotStackpercent) {}, function (_jqueryFlotFillbelow) {}, function (_jqueryFlotCrosshair) {}, function (_appPluginsPanelGraphJqueryFlotEvents) {}],
    execute: function () {

      angular.module('grafana.directives').directive('grafanaHistogram', function ($rootScope, timeSrv) {
        return {
          restrict: 'A',
          template: '<div> </div>',
          link: function link(scope, elem) {
            var ctrl = scope.ctrl;
            var dashboard = ctrl.dashboard;
            var panel = ctrl.panel;
            var data, annotations;
            var sortedSeries;
            var legendSideLastValue = null;
            var rootScope = scope.$root;
            var self = this;
            var isPng = false;

            elem.bind("plotselected", function (event, ranges) {

              if (scope.isPng) {
                scope.$apply(function () {
                  timeSrv.setTime({
                    from: moment.utc(ranges.xaxis.from),
                    to: moment.utc(ranges.xaxis.to)
                  });
                });
              } else {
                scope.zoomPlot(ranges.xaxis.from, ranges.xaxis.to);
              }
            });

            elem.bind("dblclick", function (event) {

              scope.zoomOut();
            });

            rootScope.onAppEvent('setCrosshair', function (event, info) {
              // do not need to to this if event is from this panel
              if (info.scope === scope) {
                return;
              }

              if (dashboard.sharedCrosshair) {
                var plot = elem.data().plot;
                if (plot) {
                  plot.setCrosshair({ x: info.pos.x, y: info.pos.y });
                }
              }
            }, scope);

            rootScope.onAppEvent('clearCrosshair', function () {
              var plot = elem.data().plot;
              if (plot) {
                plot.clearCrosshair();
              }
            }, scope);

            // Receive render events
            ctrl.events.on('render', function (renderData) {
              data = renderData || data;
              if (!data) {
                ctrl.refresh();
                return;
              }
              annotations = data.annotations || annotations;
              render_panel();
            });

            function getLegendHeight(panelHeight) {
              if (!panel.legend.show || panel.legend.rightSide) {
                return 2;
              }

              if (panel.legend.alignAsTable) {
                var legendSeries = _.filter(data, function (series) {
                  return series.hideFromLegend(panel.legend) === false;
                });
                var total = 23 + 22 * legendSeries.length;
                return Math.min(total, Math.floor(panelHeight / 2));
              } else {
                return 26;
              }
            }

            function setElementHeight() {
              try {
                var height = ctrl.height - getLegendHeight(ctrl.height);
                elem.css('height', height + 'px');

                return true;
              } catch (e) {
                // IE throws errors sometimes
                console.log(e);
                return false;
              }
            }

            function shouldAbortRender() {
              if (!data) {
                return true;
              }

              if (!setElementHeight()) {
                return true;
              }

              if (_.isString(data)) {
                render_png(data);
                data = [];
              }

              console.log("Should Abort Render();");
              console.log(data);

              if (elem.width() === 0) {
                return true;
              }
            }

            function drawHook(plot) {
              // Update legend values
              var yaxis = plot.getYAxes();

              if (!isPng) {
                for (var i = 0; i < data.length; i++) {
                  var series = data[i];
                  var axis = yaxis[series.yaxis - 1];
                  var formater = kbn.valueFormats[panel.yaxes[series.yaxis - 1].format];

                  // decimal override
                  if (_.isNumber(panel.decimals)) {
                    series.updateLegendValues(formater, panel.decimals, null);
                  } else {
                    // auto decimals
                    // legend and tooltip gets one more decimal precision
                    // than graph legend ticks
                    var tickDecimals = (axis.tickDecimals || -1) + 1;
                    series.updateLegendValues(formater, tickDecimals, axis.scaledDecimals + 2);
                  }

                  if (!rootScope.$$phase) {
                    scope.$digest();
                  }
                }
              }

              // add left axis labels
              if (panel.yaxes[0].label) {
                var yaxisLabel = $("<div class='axisLabel left-yaxis-label'></div>").text(panel.yaxes[0].label).appendTo(elem);

                yaxisLabel.css("margin-top", yaxisLabel.width() / 2);
              }

              // add right axis labels
              if (panel.yaxes[1].label) {
                var rightLabel = $("<div class='axisLabel right-yaxis-label'></div>").text(panel.yaxes[1].label).appendTo(elem);

                rightLabel.css("margin-top", rightLabel.width() / 2);
              }
            }

            function processOffsetHook(plot, gridMargin) {
              var left = panel.yaxes[0];
              var right = panel.yaxes[1];
              if (left.show && left.label) {
                gridMargin.left = 20;
              }
              if (right.show && right.label) {
                gridMargin.right = 20;
              }

              if (this.isPng) {
                // apply y-axis min/max options
                var yaxis = plot.getYAxes();
                for (var i = 0; i < yaxis.length; i++) {
                  var axis = yaxis[i];
                  axis.options.max = 0;
                  axis.options.min = 500;
                }
              }
            }

            function getFFT(series) {

              if (isPng) {
                return; //[];
              }

              //  console.log(series);

              // series.yaxis = 1; // TODO check
              series.stats.total = 0;
              series.stats.max = Number.MIN_VALUE;
              series.stats.min = Number.MAX_VALUE;
              series.stats.avg = null;
              series.stats.current = null;
              series.stats.count = series.datapoints.length;
              return series.datapoints;
            }

            // Function for rendering panel
            function render_panel() {
              if (shouldAbortRender()) {}
              //return;


              // this.seriesList = [];
              //  this.data = [];

              var stack = panel.stack ? true : null;

              // Populate element
              var options = {
                hooks: {
                  draw: [drawHook],
                  processOffset: [processOffsetHook]
                },
                legend: { show: false },
                series: {
                  stackpercent: panel.stack ? panel.percentage : false,
                  stack: panel.percentage ? null : stack,
                  bars: {
                    show: true,
                    fill: 0.9,
                    barWidth: 1,
                    zero: false,
                    lineWidth: 0,
                    align: 'center'
                  },
                  shadowSize: 0
                },
                yaxes: [],
                xaxis: {},
                grid: {
                  minBorderMargin: 0,
                  markings: [],
                  backgroundColor: null,
                  borderWidth: 0,
                  hoverable: true,
                  color: '#c8c8c8',
                  margin: { left: 0, right: 0 }
                },
                selection: {
                  mode: "x",
                  color: '#666'
                },
                crosshair: {
                  mode: panel.tooltip.shared || dashboard.sharedCrosshair ? "x" : null
                }
              };

              // var scopedVars = ctrl.panel.scopedVars;
              ////    var bucketSize = !panel.bucketSize && panel.bucketSize !== 0 ? null : parseFloat(ctrl.templateSrv.replaceWithText(panel.bucketSize.toString(), scopedVars));
              //    var minValue = !panel.minValue && panel.minValue !== 0 ? null : parseFloat(ctrl.templateSrv.replaceWithText(panel.minValue.toString(), scopedVars));
              //    var maxValue = !panel.maxValue && panel.maxValue !== 0 ? null : parseFloat(ctrl.templateSrv.replaceWithText(panel.maxValue.toString(), scopedVars));
              if (!isPng) {

                for (var i = 0; i < data.length; i++) {
                  var series = data[i];
                  series.data = getFFT(series);

                  options.series.bars.barWidth = (series.data[series.data.length - 1][0] + series.data[0][0]) / series.data.length; //(elem.width()/series.data.length);

                  // if hidden remove points and disable stack
                  if (ctrl.hiddenSeries[series.alias]) {
                    series.data = [];
                    series.stack = false;
                  }
                }

                // if (data.length && data[0].stats.timeStep) {
                //data[0].stats.timeStep / 1.5;
                // }
              } else {

                addAnnotations(options);
              }

              //  panel.yaxes[1].show = true;
              configureAxisOptions(data, options);
              //  addHistogramAxis(options);
              // options.selection = {};

              sortedSeries = _.sortBy(data, function (series) {
                return series.zindex;
              });

              function callPlot(incrementRenderCounter) {
                try {
                  $.plot(elem, sortedSeries, options);
                } catch (e) {
                  console.log('flotcharts error', e);
                }

                if (incrementRenderCounter) {
                  ctrl.renderingCompleted();
                }
              }

              scope.isPng = isPng;

              scope.zoomPlot = function (start, end) {

                options.xaxis.min = start;
                options.xaxis.max = end;

                callPlot(true);
              };

              scope.zoomOut = function () {
                if (isPng) {
                  //  this.ctrl.events.emit('zoom-out');
                  this.ctrl.publishAppEvent('zoom-out', 2);
                } else {
                  options.xaxis.min = null;
                  options.xaxis.max = null;
                  callPlot(true);
                }
              };

              if (shouldDelayDraw(panel)) {
                // temp fix for legends on the side, need to render twice to get dimensions right
                callPlot(false);
                setTimeout(function () {
                  callPlot(true);
                }, 50);
                legendSideLastValue = panel.legend.rightSide;
              } else {
                callPlot(true);
              }
            }

            function translateFillOption(fill) {
              return fill === 0 ? 0.001 : fill / 10;
            }

            function shouldDelayDraw(panel) {
              if (panel.legend.rightSide) {
                return true;
              }
              if (legendSideLastValue !== null && panel.legend.rightSide !== legendSideLastValue) {
                return true;
              }
            }

            function addAnnotations(options) {

              if (!annotations || annotations.length === 0) {
                return;
              }

              var types = {};
              types['$__alerting'] = {
                color: 'rgba(237, 46, 24, 1)',
                position: 'BOTTOM',
                markerSize: 5
              };

              types['$__ok'] = {
                color: 'rgba(11, 237, 50, 1)',
                position: 'BOTTOM',
                markerSize: 5
              };

              types['$__no_data'] = {
                color: 'rgba(150, 150, 150, 1)',
                position: 'BOTTOM',
                markerSize: 5
              };

              types['$__execution_error'] = ['$__no_data'];

              for (var i = 0; i < annotations.length; i++) {
                var item = annotations[i];
                if (item.newState) {
                  console.log(item.newState);
                  item.eventType = '$__' + item.newState;
                  continue;
                }

                if (!types[item.source.name]) {
                  types[item.source.name] = {
                    color: item.source.iconColor,
                    position: 'BOTTOM',
                    markerSize: 5
                  };
                }
              }

              options.events = {
                levels: _.keys(types).length + 1,
                data: annotations,
                types: types
              };
            }

            function configureAxisOptions(data, options) {

              if (isPng) {
                var ticks = elem.width() / 100;
                var min = _.isUndefined(ctrl.range.from) ? null : ctrl.range.from.valueOf();
                var max = _.isUndefined(ctrl.range.to) ? null : ctrl.range.to.valueOf();

                options.xaxis = {
                  timezone: dashboard.getTimezone(),
                  show: panel.xaxis.show,
                  mode: "time",
                  min: min,
                  max: max,
                  label: "Datetime",
                  ticks: ticks,
                  timeformat: time_format(ticks, min, max)
                };

                var defaults = {
                  position: 'left',
                  show: true,
                  index: 1,
                  logBase: 1,
                  max: 8000,
                  min: 0
                };

                options.yaxes.push(defaults);

                var secondY = _.clone(defaults);
                secondY.index = 2;
                secondY.show = true;
                secondY.logBase = 1;
                secondY.position = 'right';
                options.yaxes.push(secondY);
              } else {

                options.xaxis = {
                  show: panel['x-axis'],
                  label: "Values"
                };

                var defaults = {
                  position: 'left',
                  show: true,
                  index: 1,
                  logBase: 1,
                  max: null,
                  min: null
                };

                options.yaxes.push(defaults);

                var secondY = _.clone(defaults);
                secondY.index = 2;
                secondY.show = true;
                secondY.logBase = 1;
                secondY.position = 'right';
                options.yaxes.push(secondY);
              }
            }

            function configureAxisMode(axis, format) {
              axis.tickFormatter = function (val, axis) {
                return kbn.valueFormats[format](val, axis.tickDecimals, axis.scaledDecimals);
              };
            }

            function time_format(ticks, min, max) {
              if (min && max && ticks) {
                var range = max - min;
                var secPerTick = range / ticks / 1000;
                var oneDay = 86400000;
                var oneYear = 31536000000;

                if (secPerTick <= 45) {
                  return "%H:%M:%S";
                }
                if (secPerTick <= 7200 || range <= oneDay) {
                  return "%H:%M";
                }
                if (secPerTick <= 80000) {
                  return "%m/%d %H:%M";
                }
                if (secPerTick <= 2419200 || range <= oneYear) {
                  return "%m/%d";
                }
                return "%Y-%m";
              }

              return "%H:%M";
            }

            function render_png(url) {
              isPng = true; //' + elem.height() + ' ' + elem.width() + '
              elem.html('<img style="padding-top: 9px; padding-left: 34px; padding-bottom: 21px; padding-right: 34px;" height="100%" width="100%" src="' + url + '"></img>');
            }

            new HistogramTooltip(elem, dashboard, scope, function () {
              return sortedSeries;
            });
          }
        };
      });
    }
  };
});
//# sourceMappingURL=histogram.js.map
