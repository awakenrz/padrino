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

function interpretInfo(info) {
    switch (info.type) {
        case 'Investigation':
            return {
                name: 'Investigation',
                description: info.result
                    ? 'positive (interpret as guilty)'
                    : 'negative (interpret as not guilty)'
            };
        case 'Players':
            return {
                name: 'Players',
                description: info.players.join(', ') || 'no players'
            };
        case 'Actions':
            return {
                name: 'Actions',
                description: info.actions.map(command => command.replace(/\$\d+/g, 'someone')).join(', ') || 'no actions'
            };
        case 'Fruit':
            return {
                name: 'Fruit',
                description: 'how... generous?'
            };
    }
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
        this.props.onSave(targets).then(() => this.dismiss(),
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
            <form onSubmit={this.onSubmit.bind(this)}>
                <fieldset style={{textDecoration: !this.props.action.available ? 'line-through' : ''}} disabled={!this.props.action.available || this.state.waiting}>
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
                                        return targets === null ? <em key={i}>{this.props.action.compulsion !== 'Forced' ? 'no one' : 'someone'}</em> : <span key={i}>{targets[part.group]}</span>;
                                    }
                            }
                        })} {this.props.action.compulsion === 'Forced'
                            ? <em>(forced)</em>
                            : this.props.action.compulsion === 'Required'
                                ? <em>(compelled)</em>
                                : null}
                        {this.props.annotation ? <div><em>{this.props.annotation}</em></div> : null}

                        {!this.state.editing && this.props.action.available && this.props.action.compulsion !== 'Forced' && this.props.onSave
                            ? <button type="button" className="btn-link glyphicon glyphicon-pencil" onClick={this.startEdit.bind(this)}></button>
                            : null}
                    </div>

                    {editMode
                        ? <p className="help-block">{this.props.action.description}</p>
                        : null}

                    {editMode
                        ? <p className="form-group">
                            <button type="submit" className={"btn btn-" + this.props.buttonClass}>{this.props.buttonCaption}</button> <button onClick={this.onCancel.bind(this)} type="button" className="btn btn-default">Cancel</button>
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

    heading(name, suffix="") {
        let timeLeft = this.props.end - this.state.now;
        return <h3>{name} {this.props.turn} <small>{timeLeft > 0 ? "ends in " + this.formatDuration(timeLeft) + suffix : "ending..."}</small></h3>;
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
                            <button type="submit" className="btn btn-primary">Vote</button> <button onClick={this.onCancel.bind(this)} type="button" className="btn btn-default">Cancel</button>
                        </p>
                        : null}
                </fieldset>
            </form>
        </li>;
    }
}


class Plan extends React.Component {
    render() {
        let infoFor = {};
        let extra = [];

        this.props.messages.forEach(message => {
            if (message.i === null) {
                extra.push(message.info);
            } else {
                infoFor[message.i] = message.info;
            }
        });

        return <div>
            <ul>
                {this.props.plan.map((e, i) => {
                    let interpreted = Object.prototype.hasOwnProperty.call(infoFor, i)
                        ? interpretInfo(infoFor[i])
                        : null;
                    return <Action key={i}
                                   action={e}
                                   onSave={this.props.canEditAction(i) ? this.props.onActionSave.bind(this, i) : null}
                                   annotation={interpreted !== null ? 'Result: ' + interpreted.description : null}
                                   buttonCaption={this.props.saveButtonCaption}
                                   buttonClass={this.props.saveButtonClass} />;
                })}
            </ul>

            {extra.length > 0
                ? <div>
                    <p>You also received:</p>
                    <ul>{extra.map((e, i) => {
                        let interpreted = interpretInfo(e);
                        return <li key={i}>{interpreted.name}: {interpreted.description}</li>;
                    })}</ul>
                </div>
                : null}
        </div>;
    }
}

class Day extends Phase {
    onActionSave(i, targets) {
        return this.props.client.request('impulse', {i: i, targets: targets});
    }

    render() {
        return <div>
            {this.heading("Day", this.props.hammer ? " or strict majority reached" : "")}
            {this.props.deaths.length > 0
                ? <p>{this.props.deaths.map(player => player.name + ' the ' + player.role + ' died.').join(' ')}</p>
                : null}
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

            {this.props.plan.length > 0
                ? <div>
                    <p>Additionally, the following <strong>instantaneous</strong> actions are available:</p>
                    <Plan plan={this.props.plan}
                          onActionSave={this.onActionSave.bind(this)}
                          canEditAction={(i) => this.props.plan[i].targets === null}
                          messages={this.props.messages}
                          saveButtonClass='danger'
                          saveButtonCaption='Perform' />
                </div>
                : null}
        </div>;
    }
}

class DayResult extends React.Component {
    render() {
        return <div>
            <h3>Day {this.props.turn} <small>ended</small></h3>
            {this.props.deaths.length > 0
                ? <p>{this.props.deaths.map(player => player.name + ' the ' + player.role + ' died.').join(' ')}</p>
                : null}
            {this.props.lynched !== null
                ? <p>{this.props.lynched.name} the {this.props.lynched.role} was lynched.</p>
                : <p>Nobody was lynched.</p>}
            <ul>
                {Object.keys(this.props.votes).sort().map((e) => {
                    let target = this.props.votes[e];
                    return <li key={e}>{e} voted for {target === null ? <em>no one</em> : target}</li>;
                })}
            </ul>

            {this.props.plan.length > 0
                ? <div>
                    <p>Additionally, the following <strong>instantaneous</strong> actions were available:</p>

                    <Plan plan={this.props.plan}
                          canEditAction={(i) => false}
                          onActionSave={null}
                          messages={this.props.messages} />
                </div>
                : null}
        </div>;
    }
}

class Night extends Phase {
    onActionSave(i, targets) {
        return this.props.client.request('plan', {i: i, targets: targets});
    }

    render() {
        return <div>
            {this.heading("Night")}
            <Plan plan={this.props.plan}
                  canEditAction={(i) => true}
                  onActionSave={this.onActionSave.bind(this)}
                  messages={[]}
                  saveButtonClass='primary'
                  saveButtonCaption='Plan' />
        </div>;
    }
}

class NightResult extends React.Component {
    render() {
        return <div>
            <h3>Night {this.props.turn} <small>ended</small></h3>
            {this.props.deaths.length > 0
                ? <p>{this.props.deaths.map(player => player.name + ' the ' + player.role + ' was found dead.').join(' ')}</p>
                : <p>Nobody died.</p>}

            <Plan plan={this.props.plan}
                  canEditAction={(i) => false}
                  onActionSave={null}
                  messages={this.props.messages} />
        </div>;
    }
}

class Profile extends React.Component {
    render() {
        return <div>
            <h2 style={{textDecoration: this.props.players[this.props.name] === null ? null : 'line-through'}}>{this.props.name}</h2>
            <dl>
                <dt>Role</dt>
                <dd>{this.props.role}</dd>

                <dt>Abilities</dt>
                <dd>{this.props.abilities}</dd>

                <dt>Faction</dt>
                <dd>{this.props.faction}</dd>

                <dt>Agenda</dt>
                <dd>{this.props.agenda}</dd>

                <dt>Friends</dt>
                <dd>
                    {this.props.friends.length > 0 ? <ul>
                        {this.props.friends.sort().map(name => <li key={name}>{name}</li>)}
                    </ul> : 'none'}
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
            <p>{this.props.winners.indexOf(this.props.me) !== -1
                ? 'Congratulations!'
                : 'Better luck next time!'} The winners are:</p>
            <ul>
                {this.props.winners.sort().map(e => <li key={e}>{e}</li>)}
            </ul>
            <h4>Roles</h4>
            <ul>
                {Object.keys(this.props.roles).sort().map(player =>
                    <li key={player}>{player}: {this.props.roles[player]}</li>)}
            </ul>
            <h4>Game log</h4>
            {this.props.log.map((e, i) => <div key={i}>
                <h5>{e.phase} {e.turn}</h5>
                <ul>{e.acts.length > 0 ? e.acts.map((e, i) => {
                    return <li key={i}>{e.source}: {parseCommand(e.command).parts.map((part, i) => {
                        switch (part.type) {
                            case "text":
                                return <span key={i}>{part.text}</span>;

                            case "group":
                                return <span key={i}>{e.targets[part.group]}</span>;
                        }
                    })}</li>;
                }) : <li><em>No actions for this phase.</em></li>}
                </ul>
            </div>)}
        </div>;
    }
}

class Client {
    constructor() {
        this.onRootMessage = () => {};
        this.onPhaseEndMessage = () => {};
        this.onOpen = () => {};
        this.onClose = () => {};

        this.resetBackoff();
        this.connect();
    }

    resetBackoff() {
        this.lastReconnect = 0;
        this.nextReconnect = 1000;
    }

    stepBackoff() {
        let lastReconnect = this.lastReconnect;
        this.lastReconnect = this.nextReconnect;
        this.nextReconnect += lastReconnect;
    }

    connect() {
        let token = window.location.search.substring(1);
        this.seqNum = 0;
        this.socket = new WebSocket('ws://' + window.location.host + '/ws?' +
                                    token);

        this.socket.onopen = () => {
            this.resetBackoff();
            this.onOpen();
        };

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
        this.socket.onclose = () => {
            this.onClose();
            window.setTimeout(() => {
                this.connect();
                this.stepBackoff();
            }, this.nextReconnect);
        };
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
        this.state = {
            ready: false,
            connected: false
        };
    }

    componentWillMount() {
        this.client = new Client();
    }

    componentDidMount() {
        this.client.onRootMessage = root => {
            this.setState(root);
            this.setState({ready: true});
        };

        this.client.onPhaseEndMessage = end => {
            let state = {
                publicState: end.publicState,
                phaseState: end.phaseState
            };

            switch (end.phase) {
                case 'Night':
                    state.nightResults = this.state.nightResults.concat([end.result]);
                    break;

                case 'Day':
                    state.dayResults = this.state.dayResults.concat([end.result]);
                    break;
            }

            this.setState(state);
        };
        this.client.onOpen = () => {
            this.setState({connected: true});
        };
        this.client.onClose = () => {
            this.setState({connected: false});
        };
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.ready) {
            document.title = this.state.publicInfo.name;
        }
    }

    render() {
        if (!this.state.ready) {
            return <div>Loading...</div>;
        }

        let results = [];

        for (let i = this.state.publicState.turn; i >= 1; --i) {
            var last = i == this.state.publicState.turn;

            if (i <= this.state.dayResults.length) {
                let result = this.state.dayResults[i - 1];
                results.push(<DayResult turn={i}
                                        key={'d' + i}
                                        plan={result.plan}
                                        deaths={result.deaths}
                                        messages={result.messages}
                                        lynched={result.lynched}
                                        votes={result.ballot.votes} />);
            }

            if (i <= this.state.nightResults.length) {
                let result = this.state.nightResults[i - 1];
                results.push(<NightResult turn={i}
                                          key={'n' + i}
                                          plan={result.plan}
                                          deaths={result.deaths}
                                          messages={result.messages} />);
            }
        }

        return <div className="container">
            <div className="row">
                <div className="col-md-12"><h1>{this.state.publicInfo.name}</h1></div>
            </div>

            {!this.state.connected
                ? <div className="alert alert-warning">Lost server connection. We'll be back shortly!</div>
                : null}

            <div className="row">
                <div className="col-md-10 col-md-push-2">
                    {this.state.phaseState.phase == 'Night' ?
                        <Night client={this.client}
                               turn={this.state.publicState.turn}
                               end={this.state.publicState.phaseEnd}
                               plan={this.state.phaseState.plan} /> :
                     this.state.phaseState.phase == 'Day' ?
                        <Day client={this.client}
                             turn={this.state.publicState.turn}
                             end={this.state.publicState.phaseEnd}
                             plan={this.state.phaseState.plan}
                             me={this.state.playerInfo.name}
                             ballot={this.state.phaseState.ballot}
                             deaths={this.state.phaseState.deaths}
                             messages={this.state.phaseState.messages}
                             hammer={this.state.publicInfo.rules.indexOf('hammer') !== -1} /> :
                        <GameOver winners={this.state.phaseState.winners}
                                  log={this.state.phaseState.log}
                                  roles={this.state.phaseState.roles}
                                  me={this.state.playerInfo.name} />}
                    {results}
                    <Start motd={this.state.publicInfo.motd}
                           rules={this.state.publicInfo.rules} />
                </div>

                <div className="col-md-2 col-md-pull-10">
                    <Profile name={this.state.playerInfo.name}
                             role={this.state.playerInfo.role}
                             abilities={this.state.playerInfo.abilities}
                             faction={this.state.playerInfo.faction}
                             agenda={this.state.playerInfo.agenda}
                             friends={this.state.playerInfo.friends}
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
