// Originally from https://github.com/JedWatson/react-codemirror
// Licensed under terms of the MIT license
// Copyright (c) 2016 Jed Watson

import React from 'react';
import CodeMirror from 'codemirror';

export default class extends React.Component {
    componentDidMount() {
        this.codeMirror = new CodeMirror(this.refs.root, this.props.defaultOptions);
        this.codeMirror.on('change', this.codemirrorValueChanged.bind(this));
        this.codeMirror.on('focus', this.focusChanged.bind(this, true));
        this.codeMirror.on('blur', this.focusChanged.bind(this, false));
        this.codeMirror.on('scroll', this.scrollChanged);
        this.codeMirror.setValue(this.props.defaultValue || this.props.value || '');
    }

    getCodeMirror() {
        return this.codeMirror;
    }

    getValue() {
        return this.getCodeMirror().getValue();
    }

    focus() {
        if (this.codeMirror) {
            this.codeMirror.focus();
        }
    }

    focusChanged(focused) {
        this.props.onFocusChange && this.props.onFocusChange(focused);
    }

    scrollChanged(cm) {
        this.props.onScroll && this.props.onScroll(cm.getScrollInfo());
    }

    codemirrorValueChanged(doc, change) {
        if (this.props.onChange && change.origin != 'setValue') {
            this.props.onChange(doc.getValue());
        }
    }

    render() {
        return <div ref='root'></div>;
    }
}
