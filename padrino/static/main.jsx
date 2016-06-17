const NIGHT = 0;
const DAY = 1;
const OVER = 2;

function parseCommand(command) {
    let parts = [];
    let groups = 0;

    while (command.length > 0) {
        let text = command.match(/^[^$]+/);
        if (text !== null) {
            parts.push({
                type: 'text',
                text: text[0]
            });
            command = command.substring(text[0].length);
            continue;
        }

        let group = command.match(/^\$(\d)+/);
        if (group !== null) {
            parts.push({
                type: 'group',
                group: parseInt(group[1], 10)
            });
            command = command.substring(group[0].length);
            ++groups;
            continue;
        }

        throw "command parse error";
    }

    return {
        parts: parts,
        groups: groups
    };
}

class Action extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            editing: false,
            waiting: false,
            command: parseCommand(props.action.command)
        };
    }

    startEdit() {
        this.setState({editing: true});
    }

    dismiss() {
        this.setState({
            editing: false,
            waiting: false
        });
    }

    onSubmit(e) {
        e.preventDefault();

        let targets = [];
        for (let i = 0; i < this.state.command.groups; ++i) {
            let v = e.target.elements['target' + i].value;
            if (v === "") {
                targets = null;
                break;
            }
            targets.push(v);
        }

        this.setState({waiting: true});
        this.props.onPlan(targets).then(() => this.dismiss(),
                                        () => this.dismiss());
    }

    onCancel() {
        this.dismiss();
    }

    componentWillReceiveProps(nextProps) {
        this.setState({
            command: parseCommand(nextProps.action.command)
        });
    }

    render() {
        let editMode = this.state.editing && this.props.action.available;

        return <li>
            <form className="form-horizontal" onSubmit={this.onSubmit.bind(this)}>
                <fieldset style={{'text-decoration': !this.props.action.available ? 'line-through' : ''}} disabled={!this.props.action.available || this.state.waiting}>
                    <div className="form-inline">
                        {this.state.command.parts.map((part, i) => {
                            switch (part.type) {
                                case "text":
                                    return <span key={i}>{part.text}</span>;

                                case "group":
                                    let targets = this.props.action.targets;
                                    if (editMode) {
                                        return <select className="form-control" defaultValue={this.props.action.targets === null ? "" : this.props.action.targets[part.group]} key={i} name={'target' + part.group}>
                                            <option value="">no one</option>
                                            {this.props.action.candidates[part.group].map(candidate =>
                                                <option value={candidate} key={candidate}>{candidate}</option>)}
                                        </select>;
                                    } else {
                                        return targets === null ? <em key={i}>no one</em> : <span key={i}>{targets[part.group]}</span>;
                                    }
                            }
                        })}
                        {this.props.annotation ? <div><em>{this.props.annotation}</em></div> : null}

                        {!this.state.editing && this.props.action.available && this.props.onPlan
                            ? <button type="button" className="btn-link glyphicon glyphicon-pencil" onClick={this.startEdit.bind(this)}></button>
                            : null}
                    </div>

                    {editMode
                        ? <p className="help-block">{this.props.action.description}</p>
                        : null}

                    {editMode
                        ? <p className="form-group">
                            <button type="submit" className="btn btn-primary">Save</button> <button onClick={this.onCancel.bind(this)} type="button" className="btn btn-default">Cancel</button>
                        </p>
                        : null}
                </fieldset>
            </form>
        </li>;
    }
}

class Phase extends React.Component {
    componentWillMount() {
        this.timer = window.setInterval(this.tick.bind(this), 50);
        this.tick();
    }

    tick() {
        this.setState({now: +new Date() / 1000});
    }

    stopTimer() {
        window.clearInterval(this.timer);
    }

    componentWillUnmount() {
        this.stopTimer();
    }

    componentDidUpdate() {
        if (this.props.end - this.state.now < 0) {
            this.stopTimer();
        }
    }

    formatDuration(totalSeconds) {
        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds - (hours * 3600)) / 60);
        let seconds = Math.ceil(totalSeconds - (hours * 3600) - (minutes * 60));

        if (minutes < 10) {
            minutes = "0" + minutes;
        }

        if (seconds < 10) {
            seconds = "0" + seconds;
        }

        return hours + ':' + minutes + ':' + seconds;
    }

    heading(name) {
        let timeLeft = this.props.end - this.state.now;
        return <h3>{name} {this.props.turn} <small>{timeLeft > 0 ? "ends in " + this.formatDuration(timeLeft) : "ending..."}</small></h3>;
    }
}

class Plan extends Phase {
    onActionPlan(i, targets) {
        return this.props.client.request('plan', {i: i, targets: targets});
    }

    render() {
        return <div>
            {this.heading("Night")}
            <ul>
                {this.props.plan.map((e, i) => <Action key={i} action={e} onPlan={this.onActionPlan.bind(this, i)} />)}
            </ul>
        </div>;
    }
}

class Vote extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            editing: false,
            waiting: false
        };
    }

    startEdit() {
        this.setState({editing: true});
    }

    onSubmit(e) {
        e.preventDefault();

        let target = e.target.elements.target.value;
        if (target === '') {
            target = null;
        }

        this.setState({waiting: true});
        this.props.client.request('vote', {target: target}).then(
            () => this.dismiss(), () => this.dismiss());
    }

    dismiss() {
        this.setState({
            editing: false,
            waiting: false
        });
    }

    onCancel() {
        this.dismiss();
    }

    render() {
        let isMe = this.props.me === this.props.source;

        return <li key={this.props.source}>
            <form class="form-horizontal" onSubmit={this.onSubmit.bind(this)}>
                <fieldset disabled={this.state.waiting}>
                    <div className="form-inline">
                        {this.props.source} is voting for {this.state.editing
                            ? <select className="form-control" defaultValue={this.props.target === null ? "" : this.props.target} name="target">
                                <option value="">no one</option>
                                {this.props.candidates.sort().map(candidate =>
                                    <option value={candidate} key={candidate}>{candidate}</option>)}
                            </select>
                            : this.props.target === null ? <em>no one</em> : this.props.target}
                        {!this.state.editing && isMe
                            ? <button type="button" className="btn-link glyphicon glyphicon-pencil" onClick={this.startEdit.bind(this)}></button>
                            : null}
                    </div>

                    {this.state.editing
                        ? <p className="help-block">Vote for a player to be lynched.</p>
                        : null}

                    {this.state.editing
                        ? <p className="form-group">
                            <button type="submit" className="btn btn-danger">Vote</button> <button onClick={this.onCancel.bind(this)} type="button" className="btn btn-default">Cancel</button>
                        </p>
                        : null}
                </fieldset>
            </form>
        </li>;
    }
}

class Ballot extends Phase {
    render() {
        let timeLeft = this.props.end - this.state.now;

        return <div>
            {this.heading("Day")}

            <ul>
                {Object.keys(this.props.ballot.votes).sort().map((e, i) => {
                    let target = this.props.ballot.votes[e];
                    return <Vote key={e}
                                 client={this.props.client}
                                 source={e}
                                 target={target}
                                 me={this.props.me}
                                 candidates={this.props.ballot.candidates} />
                })}
            </ul>
        </div>;
    }
}

class DayResult extends React.Component {
    render() {
        let otherDeaths = this.props.result.deaths;
        if (this.props.result.lynched !== null) {
            otherDeaths = this.props.result.deaths.filter(player => player.name != this.props.result.lynched.name);
        }
        return <div>
            <h3>Day {this.props.turn} <small>ended</small></h3>
            {otherDeaths.length > 0
                ? <p>{otherDeaths.map(player => player.name + ' the ' + player.role + ' was found dead.').join(' ')}</p>
                : null}
            {this.props.result.lynched !== null
                ? <p>{this.props.result.lynched.name} the {this.props.result.lynched.role} was lynched.</p>
                : null}
            <ul>
                {Object.keys(this.props.result.usedBallot).sort().map((e) => {
                    let target = this.props.result.usedBallot[e];
                    return <li key={e}>{e} voted for {target === null ? <em>no one</em> : target}</li>;
                })}
            </ul>
        </div>;
    }
}

class NightResult extends React.Component {
    interpretInfo(info) {
        switch (info.type) {
            case 'Investigation':
                return {
                    name: 'Investigation',
                    description: info.result ? 'yes' : 'no'
                };
            case 'Players':
                return {
                    name: 'Players',
                    description: info.players.join(', ')
                };
            case 'Actions':
                return {
                    name: 'Actions',
                    description: info.actions.map(command => command.replace(/\$\d+/g, 'someone')).join(', ')
                };
            case 'Fruit':
                return {
                    name: 'Fruit',
                    description: 'how... generous?'
                };
        }
    }

    render() {
        let infoFor = {};
        let spare = [];

        this.props.result.messages.forEach(message => {
            if (message.i === null) {
                spare.push(message.info);
            } else {
                infoFor[message.i] = message.info;
            }
        });

        return <div>
            <h3>Night {this.props.turn} <small>ended</small></h3>
            {this.props.result.deaths.length > 0
                ? <p>{this.props.result.deaths.map(player => player.name + ' the ' + player.role + ' was found dead.').join(' ')}</p>
                : null}
            <ul>
                {this.props.result.usedPlan.map((e, i) => {
                    let interpreted = Object.prototype.hasOwnProperty.call(infoFor, i)
                        ? this.interpretInfo(infoFor[i])
                        : null;
                    return <Action key={'p' + i} action={e} annotation={interpreted !== null
                        ? 'Result: ' + interpreted.description
                        : null} />;
                })}
                {spare.map((e, i) => {
                    let interpreted = this.interpretInfo(e);
                    return <li key={'s' + i}><em>You also received:<br />{interpreted.name}: {interpreted.description}</em></li>;
                })}
            </ul>
        </div>;
    }
}

class Profile extends React.Component {
    render() {
        return <div>
            <h2>{this.props.name}</h2>
            <dl>
                <dt>Role</dt>
                <dd>{this.props.role}</dd>

                <dt>Faction</dt>
                <dd>{this.props.faction}</dd>

                <dt>Agenda</dt>
                <dd>{this.props.agenda}</dd>

                <dt>Cohorts</dt>
                <dd>
                    {this.props.cohorts.length > 0 ? <ul>
                        {this.props.cohorts.sort().map(name => <li key={name}>{name}</li>)}
                    </ul> : <em>(none)</em>}
                </dd>

                <dt>Players</dt>
                <dd>
                    <ul>
                        {Object.keys(this.props.players).sort().map(name => {
                            let role = this.props.players[name];
                            return <li key={name}>{role === null ? name : <abbr title={role}><del>{name}</del></abbr>}</li>;
                        })}
                    </ul>
                </dd>
            </dl>
        </div>;
    }
}

class Start extends React.Component {
    render() {
        let md = new Remarkable();

        return <div>
            <h3>Start</h3>
            <div dangerouslySetInnerHTML={{__html: md.render(this.props.motd)}}></div>
        </div>;
    }
}

class GameOver extends React.Component {
    render() {
        return <div>
            <h3>Game Over</h3>
            <p>Congratulations! The winners are:</p>
            <ul>
                {this.props.winners.sort().map(e => <li key={e}>{e}</li>)}
            </ul>
        </div>;
    }
}

class Client {
    constructor() {
        this.onRootMessage = () => {};
        this.onPhaseEndMessage = () => {};
        this.connect();
    }

    connect() {
        let token = window.location.search.substring(1);
        this.seqNum = 0;
        this.socket = new WebSocket('ws://' + window.location.host + '/ws?' +
                                    token);
        this.socket.onmessage = (e) => {
            let payload = JSON.parse(e.data);
            let body = payload.body;

            switch (payload.type) {
                case 'root':
                    this.onRootMessage(body);
                    break;

                case 'pend':
                    this.onPhaseEndMessage(body);
                    break;

                case 'ack':
                    this.promises[body].resolve();
                    delete this.promises[body];
                    break;

                case 'rej':
                    this.promises[body].reject();
                    delete this.promises[body];
                    break;
            }
        };

        this.promises = {};
        //this.socket.onclose = (e) => this.connect();
    }

    send(type, body) {
        let n = this.seqNum;
        this.socket.send(JSON.stringify({
            type: type,
            body: body,
            seqNum: n
        }));
        ++this.seqNum;
        return n;
    }

    request(type, body) {
        let n = this.send(type, body);
        return new Promise((resolve, reject) => {
            this.promises[n] = {resolve: resolve, reject: reject};
        });
    }
}

class Root extends React.Component {
    constructor(props) {
        super(props);
        this.state = null;
    }

    componentWillMount() {
        this.client = new Client();
    }

    componentDidMount() {
        this.client.onRootMessage = root => this.setState(root);
        this.client.onPhaseEndMessage = end => {
            let state = {
                publicState: end.publicState,
                phaseState: end.phaseState
            };

            switch (end.phase) {
                case NIGHT:
                    state.nightResults = this.state.nightResults.concat([end.result]);
                    break;

                case DAY:
                    state.dayResults = this.state.dayResults.concat([end.result]);
                    break;
            }

            this.setState(state);
        };
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.publicInfo !== null) {
            document.title = this.state.publicInfo.name;
        }
    }

    render() {
        if (this.state === null) {
            return <div>Loading...</div>;
        }

        let results = [];

        for (let i = this.state.publicState.turn; i >= 1; --i) {
            var last = i == this.state.publicState.turn;

            if (i <= this.state.dayResults.length) {
                results.push(<DayResult turn={i}
                                        key={'d' + i}
                                        result={this.state.dayResults[i - 1]} />);
            }

            if (i <= this.state.nightResults.length) {
                results.push(<NightResult turn={i}
                                          key={'n' + i}
                                          result={this.state.nightResults[i - 1]} />);
            }
        }

        return <div className="container">
            <div className="row">
                <div className="col-md-12"><h1>{this.state.publicInfo.name}</h1></div>
            </div>

            <div className="row">
                <div className="col-md-10 col-md-push-2">
                    {this.state.phaseState.phase == NIGHT ?
                        <Plan client={this.client}
                              turn={this.state.publicState.turn}
                              end={this.state.publicState.phaseEnd}
                              plan={this.state.phaseState.plan} /> :
                     this.state.phaseState.phase == DAY ?
                        <Ballot client={this.client}
                                me={this.state.playerInfo.name}
                                turn={this.state.publicState.turn}
                                end={this.state.publicState.phaseEnd}
                                ballot={this.state.phaseState.ballot} /> :
                        <GameOver winners={this.state.phaseState.winners} />}
                    {results}
                    <Start motd={this.state.publicInfo.motd} />
                </div>

                <div className="col-md-2 col-md-pull-10">
                    <Profile name={this.state.playerInfo.name}
                             role={this.state.playerInfo.role}
                             faction={this.state.playerInfo.faction}
                             agenda={this.state.playerInfo.agenda}
                             cohorts={this.state.playerInfo.cohorts}
                             players={this.state.publicState.players} />
                </div>
            </div>

            <div className="row">
                <footer className="col-md-12">
                    Got feedback? <a href="https://github.com/rfw/padrino/issues/new">Things looking funny?</a> <a href="https://github.com/rfw/cosanostra/issues/new">Dispute a result?</a>
                </footer>
            </div>
        </div>;
    }
}

ReactDOM.render(<Root/>, document.querySelector('main'));
