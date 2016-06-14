class Root extends React.Component {
    constructor(props) {
        super(props);
        this.state = {motd: ''};
    }

    componentWillMount() {
        let token = window.location.search.substring(1);
        this.socket = new WebSocket('ws://' + window.location.host + '/?' +
                                    token);
    }

    componentDidMount() {
        this.setState({motd: "Hello!"});
    }

    render() {
        return <div>{this.state.motd}</div>;
    }
}

ReactDOM.render(<Root/>, document.getElementById("root"));
