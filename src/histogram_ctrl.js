import 'app/plugins/panel/graph/legend';
import 'app/plugins/panel/graph/series_overrides_ctrl';

import template from './template';
import angular from 'angular';
import moment from 'moment';
import kbn from 'app/core/utils/kbn';
import _ from 'lodash';
import TimeSeries from 'app/core/time_series2';
import * as fileExport from 'app/core/utils/file_export';
import {MetricsPanelCtrl} from 'app/plugins/sdk';

export class HistogramCtrl extends MetricsPanelCtrl {
  /** @ngInject */
  constructor($scope, $injector, annotationsSrv) {
    super($scope, $injector);

    this.annotationsSrv = annotationsSrv;
    this.hiddenSeries = {};
    this.seriesList = [];
    this.colors = [];
    
    this.isPng  = false;

    var panelDefaults = {
      // datasource name, null = default datasource
      datasource: null,
      // sets client side (flot) or native graphite png renderer (png)
      renderer: 'flot',
      // sets bucket mode (size) for wxact bucket size or (count) to calculate size from min,max and count values
      bucketMode: 'size',
      yaxes: [
        {
          label: null,
          show: true,
          logBase: 1,
          min: null,
          max: null,
          format: 'short'
        },
        {
          label: null,
          show: true,
          logBase: 1,
          min: null,
          max: null,
          format: 'short'
        }
      ],
      xaxis: {
        show: true
      },
      grid          : {
        threshold1: null,
        threshold2: null,
        threshold1Color: 'rgba(216, 200, 27, 0.27)',
        threshold2Color: 'rgba(234, 112, 112, 0.22)'
      },
      // show/hide lines
      lines         : true,
      // fill factor
      fill          : 1,
      // line width in pixels
      linewidth     : 2,
      // show hide points
      points        : false,
      // point radius in pixels
      pointradius   : 5,
      // show hide bars
      bars          : false,
      // enable/disable stacking
      stack         : false,
      // stack percentage mode
      percentage    : false,
      // legend options
      legend: {
        show: true, // disable/enable legend
        values: false, // disable/enable legend values
        min: false,
        max: false,
        current: false,
        total: false,
        avg: false
      },
      // how null points should be handled
      nullPointMode : 'connected',
      // staircase line mode
      steppedLine: false,
      // tooltip options
      tooltip       : {
        value_type: 'cumulative',
        shared: true,
        ordering: 'alphabetical',
        msResolution: false,
      },
      // time overrides
      timeFrom: null,
      timeShift: null,
      // metric queries
      targets: [{}],
      // series color overrides
      aliasColors: {},
      // other style overrides
      seriesOverrides: [],
    };

    _.defaults(this.panel, panelDefaults);
    _.defaults(this.panel.tooltip, panelDefaults.tooltip);
    _.defaults(this.panel.grid, panelDefaults.grid);
    _.defaults(this.panel.legend, panelDefaults.legend);

    this.colors = $scope.$root.colors;

    this.events.on('render', this.onRender.bind(this));
    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataSnapshotLoad.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('init-panel-actions', this.onInitPanelActions.bind(this));
  }

  onInitEditMode() {
    this.addEditorTab('Legend', 'public/app/plugins/panel/graph/tab_legend.html', 2);
    this.addEditorTab('Display', 'public/plugins/mtanda-histogram-panel/tab_display.html', 3);
   // this.addEditorTab('Histogram Options', 'public/plugins/mtanda-histogram-panel/tab_options.html', 4);

    this.logScales = {
      'linear': 1,
      'log (base 2)': 2,
      'log (base 10)': 10,
      'log (base 32)': 32,
      'log (base 1024)': 1024
    };
    this.unitFormats = kbn.getUnitFormats();
  }

  onInitPanelActions(actions) {
    actions.push({text: 'Export CSV (series as rows)', click: 'ctrl.exportCsv()'});
    actions.push({text: 'Export CSV (series as columns)', click: 'ctrl.exportCsvColumns()'});
    actions.push({text: 'Toggle legend', click: 'ctrl.toggleLegend()'});
  }

  setUnitFormat(axis, subItem) {
    axis.format = subItem.value;
    this.render();
  }

  issueQueries(datasource) {
    this.annotationsPromise = this.annotationsSrv.getAnnotations({
      dashboard: this.dashboard,
      panel: this.panel,
      range: this.range,
    });
    return super.issueQueries(datasource);
  }
  
    zoomOut(evt) {
    this.publishAppEvent('zoom-out', evt);
  }

  onDataSnapshotLoad(snapshotData) {
    this.annotationsPromise = this.annotationsSrv.getAnnotations({
      dashboard: this.dashboard,
      panel: this.panel,
      range: this.range,
    });
    this.onDataReceived(snapshotData);
  }

  onDataError(err) {
    this.seriesList = [];
    this.render([]);
  }

  onDataReceived(dataList) {
      //  this.dataList = dataList;
     
    // png renderer returns just a url
    if (_.isString(dataList)) {
      this.seriesList.url = dataList;
      this.isPng = true;
    } else {
        this.seriesList = dataList.map(this.seriesHandler.bind(this));
    }

    this.datapointsWarning = false;
    this.datapointsCount = 0;
    this.datapointsOutside = false;
    
    this.datapointsWarning = this.datapointsCount === 0 || this.datapointsOutside;

    
      this.annotationsPromise.then(result => {
      this.loading = false;
      this.alertState = result.alertState;
      this.annotations = result.annotations;
      this.seriesList.annotations = this.annotations;
      this.render(this.seriesList);
    }, () => {
      this.loading = false;
      this.render(this.seriesList);
    });
           
           


 

    
        
  }

  seriesHandler(seriesData, index) {
      
     // if(isPng){
    //      return [];
    //  } 

    var datapoints = seriesData.datapoints;
    var alias = seriesData.target;
    var colorIndex = index % this.colors.length;
    var color = this.panel.aliasColors[alias] || this.colors[colorIndex];

    var series = new TimeSeries({
      datapoints: datapoints,
      alias: alias,
      color: color,
      unit: seriesData.unit,
    });

    if (datapoints && datapoints.length > 0) {
   //   var last = moment.utc(datapoints[datapoints.length - 1][1]);
   //   var from = moment.utc(this.range.from);
   //   if (last - from < -10000) {
   //     this.datapointsOutside = true;
   //   }

      this.datapointsCount += datapoints.length;
      this.panel.tooltip.msResolution = this.panel.tooltip.msResolution || series.isMsResolutionNeeded();
    }


    return series;
  }

  onRender() {
    if (!this.seriesList) { return; }

    _.each(this.seriesList, series => {
      series.applySeriesOverrides(this.panel.seriesOverrides);

      if (series.unit) {
        this.panel.yaxes[series.yaxis-1].format = series.unit;
      }
    });
  }

  changeSeriesColor(series, color) {
    series.color = color;
    this.panel.aliasColors[series.alias] = series.color;
    this.render();
  }

  toggleSeries(serie, event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      if (this.hiddenSeries[serie.alias]) {
        delete this.hiddenSeries[serie.alias];
      } else {
        this.hiddenSeries[serie.alias] = true;
      }
    } else {
      this.toggleSeriesExclusiveMode(serie);
    }
    this.render();
  }

  toggleSeriesExclusiveMode (serie) {
    var hidden = this.hiddenSeries;

    if (hidden[serie.alias]) {
      delete hidden[serie.alias];
    }

    // check if every other series is hidden
    var alreadyExclusive = _.every(this.seriesList, value => {
      if (value.alias === serie.alias) {
        return true;
      }

      return hidden[value.alias];
    });

    if (alreadyExclusive) {
      // remove all hidden series
      _.each(this.seriesList, value => {
        delete this.hiddenSeries[value.alias];
      });
    } else {
      // hide all but this serie
      _.each(this.seriesList, value => {
        if (value.alias === serie.alias) {
          return;
        }

        this.hiddenSeries[value.alias] = true;
      });
    }
  }

  toggleAxis(info) {
    var override = _.find(this.panel.seriesOverrides, {alias: info.alias});
    if (!override) {
      override = { alias: info.alias };
      this.panel.seriesOverrides.push(override);
    }
    info.yaxis = override.yaxis = info.yaxis === 2 ? 1 : 2;
    this.render();
  };

  addSeriesOverride(override) {
    this.panel.seriesOverrides.push(override || {});
  }

  removeSeriesOverride(override) {
    this.panel.seriesOverrides = _.without(this.panel.seriesOverrides, override);
    this.render();
  }

  // Called from panel menu
  toggleLegend() {
    this.panel.legend.show = !this.panel.legend.show;
    this.refresh();
  }

  legendValuesOptionChanged() {
    var legend = this.panel.legend;
    legend.values = legend.min || legend.max || legend.avg || legend.current || legend.total;
    this.render();
  }

  exportCsv() {
    fileExport.exportSeriesListToCsv(this.seriesList);
  }

  exportCsvColumns() {
    fileExport.exportSeriesListToCsvColumns(this.seriesList);
  }
}

HistogramCtrl.template = template;
