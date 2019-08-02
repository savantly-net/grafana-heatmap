import { MetricsPanelCtrl } from 'grafana/app/plugins/sdk';
import defaultsDeep from 'lodash/defaultsDeep';

import * as d3 from 'd3';
import TimeSeries from 'grafana/app/core/time_series2';
import kbn from 'grafana/app/core/utils/kbn';
import { heatmapEditor, displayEditor } from './properties';
import _ from 'lodash';
import moment from 'moment';
import { auto } from 'angular';

// Inspired by
// http://bl.ocks.org/ganeshv/6a8e9ada3ab7f2d88022

const panelDefaults = {
  // other style overrides
  seriesOverrides: [],
  thresholds: '0,10',
  colors: ['rgba(50, 172, 45, 1)', 'rgba(241, 255, 0, 1)', 'rgba(245, 54, 54, 1)'],
  legend: {
    show: true,
    min: true,
    max: true,
    avg: true,
    current: true,
    total: true,
  },
  maxDataPoints: 100,
  mappingType: 1,
  nullPointMode: 'connected',
  format: 'none',
  valueMaps: [{ value: 'null', op: '=', text: 'N/A' }],
  treeMap: {
    mode: 'squarify',
    groups: [{ key: 'server', value: '/^.*./g' }],
    colorByFunction: 'max',
    sizeByFunction: 'constant',
    enableTimeBlocks: false,
    enableGrouping: true,
    debug: false,
    depth: 0,
    ids: ['alias'],
    nodeSizeProperty: 'value',
  },
};

/*
const treeMapDefaults = {
  title: 'Change-me', // Title
  rootname: 'TOP', // Name of top-level entity in case data is an array
  format: ',d', // Format as per d3.format (https://github.com/mbostock/d3/wiki/Formatting)
  field: 'data', // Object field to treat as data [default: data]
  width: 960, // Width of SVG
  height: 500, // Height of SVG
  margin: { top: 48, right: 0, bottom: 0, left: 0 }, // Margin as per D3 convention
};
*/

export default class HeatmapCtrl extends MetricsPanelCtrl {
  static templateUrl = './partials/module.html';
  containerDivId: string;
  series: TimeSeries[] = [];
  canvas: HTMLCanvasElement;
  panelOptions = {
    aggregationFunctions: ['avg', 'min', 'max', 'total', 'current', 'count'],
    treeMap: {
      modes: ['squarify', 'slice', 'dice', 'slice-dice'],
      aggregationFunctions: ['sum', 'min', 'max', 'extent', 'mean', 'median', 'quantile', 'variance', 'deviation'],
      timestampFormats: ['YYYY-MM-DDTHH', 'YYYY-MM-DDTHH:mm', 'YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DDTHH:mm:ss.sssZ'],
    },
  };

  constructor($scope: any, $injector: auto.IInjectorService, private elem: JQuery) {
    super($scope, $injector);
    defaultsDeep(this.panel, panelDefaults);

    this.canvas = this.elem.find('.canvas')[0] as HTMLCanvasElement;
    this.panel.chartId = 'chart_' + this.panel.id;
    this.containerDivId = 'container_' + this.panel.chartId;
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on('data-error', this.handleError.bind(this));
    this.initializePanel();
  }

  initializePanel() {}

  handleError(err: any) {
    console.error(err);
  }

  onInitEditMode() {
    this.addEditorTab('Heatmap', heatmapEditor, 2);
    this.addEditorTab('Display', displayEditor, 3);
  }

  onDataReceived(dataList: any[]) {
    console.info('received data');
    console.debug(dataList);
    if (undefined !== dataList) {
      this.series = dataList.map(seriesData => this.seriesHandler(seriesData));
      console.info('mapped dataList to series');
    }

    const preparedData = this.d3plusDataProcessor(this.series);
    this.render(preparedData);
  }

  getGroupKeys() {
    return this.panel.treeMap.groups.map((group: any) => {
      return group.key;
    });
  }

  /**
   * Prepare data for d3plus
   */
  d3plusDataProcessor(dataArray: TimeSeries[]) {
    let resultArray = [];
    const hasGroups = this.panel.treeMap.groups.length > 0;

    if (!hasGroups) {
      // just add the original items since there are no groups
      for (let dataIndex = 0; dataIndex < dataArray.length; dataIndex++) {
        const newDataItem = Object.assign({}, dataArray[dataIndex], dataArray[dataIndex].stats);
        resultArray.push(newDataItem);
      }
    } else {
      // Process Groups
      const groupArray = [];
      for (let groupIndex = 0; groupIndex < this.panel.treeMap.groups.length; groupIndex++) {
        groupArray.push({
          key: this.panel.treeMap.groups[groupIndex].key,
          regex: kbn.stringToJsRegex(this.panel.treeMap.groups[groupIndex].value),
        });
      }
      for (let dataIndex = 0; dataIndex < dataArray.length; dataIndex++) {
        const newDataItem = Object.assign({}, dataArray[dataIndex]);
        // only add the stats if we arent using granular timeblock data
        if (!this.panel.treeMap.enableTimeBlocks) {
          Object.assign(newDataItem, dataArray[dataIndex].stats);
        }
        delete newDataItem.stats;

        for (let groupIndex = 0; groupIndex < groupArray.length; groupIndex++) {
          const key = groupArray[groupIndex].key;
          const regex = groupArray[groupIndex].regex;
          const matches = newDataItem.alias.match(regex);
          if (matches && matches.length > 0) {
            (newDataItem as any)[key] = matches[0];
          } else {
            (newDataItem as any)[key] = 'NA';
          }
        }
        resultArray.push(newDataItem);
      }
    }

    // If we're using timeBlocks mode
    // replace the aggregated series with individual records
    if (this.panel.treeMap.enableTimeBlocks) {
      console.info('creating timeblock records');
      const timeBlockArray = [];
      for (let dataIndex = 0; dataIndex < resultArray.length; dataIndex++) {
        console.debug('dataIndex:' + dataIndex + ', alias:' + resultArray[dataIndex].alias);
        const dataSeries = resultArray[dataIndex];
        for (let dataPointIndex = 0; dataPointIndex < dataSeries.flotpairs.length; dataPointIndex++) {
          const dataSeriesCopy = Object.assign({}, dataSeries);
          delete dataSeriesCopy.datapoints;
          delete dataSeriesCopy.flotpairs;
          dataSeriesCopy.count = 1;
          dataSeriesCopy.timestamp = dataSeries.flotpairs[dataPointIndex][0];
          dataSeriesCopy.value = dataSeries.flotpairs[dataPointIndex][1];
          timeBlockArray.push(dataSeriesCopy);
        }
      }
      resultArray = timeBlockArray;
    }

    return resultArray;
  }

  /**
   * Series Handler
   */
  seriesHandler(seriesData: TimeSeries) {
    const series = new TimeSeries({
      datapoints: seriesData.datapoints,
      alias: (seriesData as any).target.replace(/"|,|;|=|:|{|}/g, '_'),
    });
    series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
    return series;
  } // End seriesHandler()

  addSeriesOverride(override: any) {
    this.panel.seriesOverrides.push(override || {});
  }

  addTreeMapGroup(group: any) {
    this.panel.treeMap.groups.push(group || {});
  }

  removeSeriesOverride(override: any) {
    this.panel.seriesOverrides = _.without(this.panel.seriesOverrides, override);
    this.render();
  }

  removeTreeMapGroup(group: any) {
    this.panel.treeMap.groups = _.without(this.panel.treeMap.groups, group);
    this.render();
  }

  updateThresholds() {
    // var thresholdCount = this.panel.thresholds.length;
    // var colorCount = this.panel.colors.length;
    this.refresh();
  }

  changeColor(colorIndex: number, color: string) {
    this.panel.colors[colorIndex] = color;
  }

  removeColor(colorIndex: number) {
    this.panel.colors.splice(colorIndex, 1);
  }

  addColor() {
    this.panel.colors.push('rgba(255, 255, 255, 1)');
  }

  getGradientForValue(data: any, value: any) {
    const min = Math.min.apply(Math, data.thresholds);
    const max = Math.max.apply(Math, data.thresholds);
    const absoluteDistance = max - min;
    const valueDistanceFromMin = value - min;
    let xPercent = valueDistanceFromMin / absoluteDistance;
    // Get the smaller number to clamp at 0.99 max
    xPercent = Math.min(0.99, xPercent);
    // Get the larger number to clamp at 0.01 min
    xPercent = Math.max(0.01, xPercent);

    return getColorByXPercentage(this.canvas, xPercent);
  }

  applyOverrides(seriesItemAlias: string) {
    const seriesItem: any = {},
      colorData: any = {};
    let overrides: any = {};
    console.info('applying overrides for seriesItem');
    console.debug(seriesItemAlias);
    console.debug(this.panel.seriesOverrides);
    for (let i = 0; i <= this.panel.seriesOverrides.length; i++) {
      console.debug('comparing:');
      console.debug(this.panel.seriesOverrides[i]);
      if (this.panel.seriesOverrides[i] && this.panel.seriesOverrides[i].alias === seriesItemAlias) {
        overrides = this.panel.seriesOverrides[i];
      }
    }
    colorData.thresholds = (overrides.thresholds || this.panel.thresholds).split(',').map((strVale: string) => {
      return Number(strVale.trim());
    });
    colorData.colorMap = this.panel.colors;
    seriesItem.colorData = colorData;

    seriesItem.valueName = overrides.valueName || this.panel.valueName;

    return seriesItem;
  }

  invertColorOrder() {
    this.panel.colors.reverse();
    this.refresh();
  }

  addTreeMapId() {
    this.panel.treeMap.ids.push('');
    this.refresh();
  }

  removeTreeMapId(pos: number) {
    this.panel.treeMap.ids.splice(pos, 1);
    this.refresh();
  }

  changeTreeMapId(idString: string, pos: number) {
    this.panel.treeMap.ids[pos] = idString;
  }

  // #############################################
  // link
  // #############################################

  link(scope: any, elem: JQuery, attrs: any, ctrl: any) {
    const canvas = this.canvas;
    const chartElement = elem.find('.heatmap');
    chartElement.append('<div id="' + ctrl.containerDivId + '"></div>');
    const chartContainer = document.getElementById(ctrl.containerDivId);
    console.debug('found chartContainer');
    console.debug(chartContainer);
    elem.css('height', ctrl.height + 'px');

    const gradientValueMax = elem.find('.gradient-value-max')[0];
    const gradientValueMin = elem.find('.gradient-value-min')[0];

    const visFormat = {
      text: (text: string, opts: any) => {
        if (opts.key === 'timestamp') {
          const timestamp = moment(Number(text));
          return timestamp.format(ctrl.panel.treeMap.timestampFormat);
        } else if (ctrl.getGroupKeys().indexOf(opts.key) > -1) {
          return text;
        } else {
          // return d3plus.string.title(text, opts);
          return 'change-me-visFormat';
        }
      },
    };
    console.log(visFormat);

    function render(data: any) {
      updateSize();
      updateCanvasStyle();
      updateChart(data);
    }

    function updateCanvasStyle() {
      canvas.width = Math.max(chartElement[0].clientWidth, 100);
      const canvasContext = canvas.getContext('2d');
      if (canvasContext == null) {
        return;
      }
      canvasContext.clearRect(0, 0, canvas.width, canvas.height);

      const grd = canvasContext.createLinearGradient(0, 0, canvas.width, 0);
      const colorWidth = 1 / Math.max(ctrl.panel.colors.length, 1);
      for (let i = 0; i < ctrl.panel.colors.length; i++) {
        const currentColor = ctrl.panel.colors[i];
        grd.addColorStop(Math.min(colorWidth * i, 1), currentColor);
      }
      canvasContext.fillStyle = grd;
      canvasContext.fillRect(0, 0, canvas.width, 3);
      ctrl.canvasContext = canvasContext;

      gradientValueMax.innerText = Math.max.apply(Math, ctrl.panel.thresholds.split(',')).toString();
      gradientValueMin.innerText = Math.min.apply(Math, ctrl.panel.thresholds.split(',')).toString();
    }

    function updateSize() {
      elem.css('height', ctrl.height + 'px');
    }

    /*
    function getVisSize(dataPoint: any) {
      if (ctrl.panel.treeMap.sizeByFunction === 'constant') {
        return 1;
      } else {
        return dataPoint[ctrl.panel.treeMap.sizeByFunction] || dataPoint.value;
      }
    }

    function getVisColor(dataPoint: any) {
      const value = dataPoint[ctrl.panel.treeMap.colorByFunction] || dataPoint.value;
      const rgbColor = ctrl.getGradientForValue({ thresholds: ctrl.panel.thresholds.split(',') }, value);
      const hexColor = colorToHex(rgbColor);
      return hexColor;
    }
    */

    function updateChart(data: any) {
      d3.select('#' + ctrl.containerDivId)
        .selectAll('*')
        .remove();

      // Make sure the necessary IDs are added
      const idKeys = Array.from(ctrl.panel.treeMap.ids);
      if (idKeys.length === 0) {
        ensureArrayContains(idKeys, 'alias');
      }
      if (ctrl.panel.treeMap.enableTimeBlocks) {
        ensureArrayContains(idKeys, 'timestamp');
      }

      // Setup Aggregations
      const aggs: any = {};
      aggs.value = ctrl.panel.treeMap.aggregationFunction;
      aggs.current = ctrl.panel.treeMap.aggregationFunction;
      aggs.count = 'sum';
      aggs.total = 'sum';
      aggs.avg = 'mean';
      aggs.min = 'min';
      aggs.max = 'max';

      // TODO: draw the graph
    }

    this.events.on('render', function onRender(data: any) {
      if (data) {
        render(data);
        ctrl.renderingCompleted();
      } else {
        console.info('no data');
      }
    });
  }
  // End Class
}

function ensureArrayContains(array: any[], value: any) {
  if (array.indexOf(value) === -1) {
    array.push(value);
  }
}

/*
function colorToHex(color: string) {
  if (color.substr(0, 1) === '#') {
    return color;
  }
  const digits = color.replace(/[rgba\(\)\ ]/g, '').split(',');
  while (digits.length < 3) {
    digits.push('255');
  }

  const red = parseInt(digits[0], 10);
  const green = parseInt(digits[1], 10);
  const blue = parseInt(digits[2], 10);

  const rgba = blue | (green << 8) | (red << 16);
  return '#' + rgba.toString(16);
}
*/

function getColorByXPercentage(canvas: HTMLCanvasElement, xPercent: number) {
  const x = canvas.width * xPercent || 0;
  const context = canvas.getContext('2d');
  if (context != null) {
    const p = context.getImageData(x, 1, 1, 1).data;
    const color = 'rgba(' + [p[0] + ',' + p[1] + ',' + p[2] + ',' + p[3]] + ')';
    return color;
  } else {
    return 'rgba(0,0,0,0)';
  }
}

export { HeatmapCtrl, HeatmapCtrl as MetricsPanelCtrl };
