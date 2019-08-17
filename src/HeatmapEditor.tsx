import React, { PureComponent } from 'react';

// Types
import { PanelEditorProps, Switch, LegendOptions } from '@grafana/ui';
import { Options } from './types';

export class HeatmapEditor extends PureComponent<PanelEditorProps<Options>> {

  onLegendOptionsChange = (options: LegendOptions) => {
    this.props.onOptionsChange( { ...this.props.options, legend: options });
  };
  private onToggleLines: any = ()=> {
    console.log("test");
  };
  private showLines = false;
  render() {
    return (
      <>
        <div className="section gf-form-group">
          <h5 className="section-heading">Draw Modes</h5>
          <Switch label="Lines" labelClass="width-5" checked={this.showLines} onChange={this.onToggleLines} />
        </div>
      </>
    );
  }
}
