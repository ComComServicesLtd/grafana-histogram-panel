## Histogram Panel Plugin for Grafana

This plugin show the Histogram of time series data.

![](https://raw.githubusercontent.com/mtanda/grafana-histogram-panel/master/dist/images/histogram.png)

### How this plugin works

This plugin receives raw time series data with value,timestamp pairs like other plugins however it works on data that is not a valid unix epoch... Lets say our incomming data looks like this

value: 12.21, timestamp: 1
value: 12.13, timestamp: 2
value: 13.32, timestamp: 3
value: 14.57, timestamp: 4
value: 15.52, timestamp: 5
value: 12.24, timestamp: 6

The y values would be plotted normally, but the x axis would go from 1 to 6, since these are not valid timestamps the drag zoom function would be broken, to fix this we only zoom on the localized data without trying to fetch new data from the server.  Zooming on this graph will not affect other graphs.

### Supported Datasources

I confirmed this plugin work with following datasource.

- Prometheus

But, this plugin can handle time series data (defined by Grafana plugin interface).

Should work with Graphite / InfluxDB / OpenTSDB.

### Options

- Bucket Size
  - Can configure bucket size to make histogram data.

### Known Issues

- This plugin doesn't support Elasticsearch aggregation.
  - Can't handle the Elasticsearch aggregation result yet.

------

#### Changelog

##### v0.1.6
- Support Grafana 4.0

##### v0.1.5
- Refactoring

##### v0.1.4
- Add template variable support
- Add bucket mode
- Fix sorting of buckets
- Fix tooltip display

##### v0.1.3
- Fix avg legend

##### v0.1.2
- Add min/max option

##### v0.1.1
- Update document
