import React from 'react';
import ReactDOM from 'react-dom';
import CodeMirror from './react-codemirror.jsx';
import Remarkable from 'remarkable';
import jwtDecode from 'jwt-decode';
import querystring from 'querystring';
import {} from 'codemirror/mode/markdown/markdown';

const REMARKABLE = new Remarkable('commonmark', {
    html: false
});

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
        case 'GuiltInfo':
            return {
                name: 'Guilt',
                description: info.isGuilty
                    ? 'guilty'
                    : 'not guilty'
            };
        case 'PlayersInfo':
            return {
                name: 'Players',
                description: info.players.join(', ') || 'no players'
            };
        case 'ActionsInfo':
            return {
                name: 'Actions',
                description: info.actions.map(command => command.replace(/\$\d+/g, 'someone')).join(', ') || 'no actions'
            };
        case 'FruitInfo':
            return {
                name: 'Fruit',
                description: 'how... generous?'
            };
        case 'RoleInfo':
            return {
                name: 'Role',
                description: info.role
            };
        case 'GreetingInfo':
            return {
                name: 'Greeting',
                description: <span><strong>{info.greeter}</strong> says howdy from the <strong>{info.faction}</strong> faction!</span>
            }
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

        let targets;

        if (this.state.command.groups === 0) {
            targets = e.target.elements.on.checked ? [] : null;
        } else {
            targets = [];
            for (let i = 0; i < this.state.command.groups; ++i) {
                let v = e.target.elements['target' + i].value;
                if (v === "") {
                    targets = null;
                    break;
                }
                targets.push(v);
            }
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
        let editMode = this.state.editing && this.props.action.available && this.props.onSave !== null;

        // ugh 0-target actions
        let editor;

        if (this.state.command.groups > 0) {
            editor = this.state.command.parts.map((part, i) => {
                switch (part.type) {
                    case "text":
                        return <span key={i}>{part.text}</span>;

                    case "group":
                        let targets = this.props.action.targets;
                        if (editMode) {
                            return <select className="form-control" defaultValue={this.props.action.targets === null ? "" : this.props.action.targets[part.group]} key={i} name={'target' + part.group}>
                                <option value="">no one</option>
                                {this.props.action.candidates[part.group].sort().map(candidate =>
                                    <option value={candidate} key={candidate}>{candidate}</option>)}
                            </select>;
                        } else {
                            return targets === null ? <em key={i}>{this.props.action.compulsion !== 'Forced' ? 'no one' : 'someone'}</em> : <strong key={i}>{targets[part.group]}</strong>;
                        }
                }
            });
        } else {
            editor = <span>
                {this.props.action.command} {editMode
                    ? <input type="checkbox" defaultChecked={this.props.action.targets !== null} name='on' />
                    : this.props.action.targets !== null
                        ? <span> <strong>on</strong></span>
                        : <span> <em>off</em></span>}
            </span>;
        }

        return <li>
            <form onSubmit={this.onSubmit.bind(this)}>
                <fieldset disabled={!this.props.action.available || this.state.waiting}>
                    <div className="form-inline">
                        <div className="form-group" style={{textDecoration: !this.props.action.available ? 'line-through' : ''}}>
                            {editor}{this.props.action.compulsion === 'Forced'
                                ? <em>(forced)</em>
                                : this.props.action.compulsion === 'Required'
                                    ? <em>(compelled)</em>
                                    : null}
                            {this.props.annotation ? <span> ⇒ {this.props.annotation}</span> : null}
                            {!this.state.editing && this.props.action.available && this.props.action.compulsion !== 'Forced' && this.props.onSave !== null
                                ? <button type="button" className="btn-link glyphicon glyphicon-pencil" onClick={this.startEdit.bind(this)}></button>
                                : null}
                        </div>

                        {editMode
                            ? <span> <button type="submit" className={"btn btn-" + this.props.buttonClass}>{this.props.buttonCaption}</button> <button onClick={this.onCancel.bind(this)} type="button" className="btn btn-default">Cancel</button></span>
                            : null}
                    </div>

                    {editMode
                        ? <p className="help-block">{this.props.action.description}</p>
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
        if (this.isTwilightEnding()) {
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

    getPrimaryEndTime() {
        return this.props.end - this.props.twilightDuration;
    }

    getPrimaryTimeLeft() {
        return this.getPrimaryEndTime() - this.state.now;
    }

    isPrimaryEnding() {
        return this.getPrimaryTimeLeft() <= 0;
    }

    getTwilightTimeLeft() {
        return this.props.end - this.state.now;
    }

    isTwilightEnding() {
        return this.getTwilightTimeLeft() <= 0;
    }

    heading(name, primarySuffix='') {
        return <h3>{name} {this.props.turn} <small>{
            !this.isPrimaryEnding()
                ? "ends in " + this.formatDuration(this.getPrimaryTimeLeft()) + (primarySuffix !== '' ? ' ' + primarySuffix : '')
                : !this.isTwilightEnding()
                    ? "twilight ends in " + this.formatDuration(this.getTwilightTimeLeft())
                    : "ending..."}</small></h3>;
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
                        <div className="form-group">
                            <strong>{this.props.source}</strong> is voting for {this.state.editing
                                ? <select className="form-control" defaultValue={this.props.target === null ? "" : this.props.target} name="target">
                                    <option value="">no one</option>
                                    {this.props.candidates.sort().map(candidate =>
                                        <option value={candidate} key={candidate}>{candidate}</option>)}
                                </select>
                                : this.props.target === null ? <em>no one</em> : <strong>{this.props.target}</strong>}
                            {!this.state.editing && isMe && this.props.canEdit
                                ? <button type="button" className="btn-link glyphicon glyphicon-pencil" onClick={this.startEdit.bind(this)}></button>
                                : null}
                        </div>

                        {this.state.editing && this.props.canEdit
                            ? <span> <button type="submit" className="btn btn-primary">Vote</button> <button onClick={this.onCancel.bind(this)} type="button" className="btn btn-default">Cancel</button></span>
                            : null}
                    </div>

                    {this.state.editing && this.props.canEdit
                        ? <p className="help-block">Vote for a player to be lynched.</p>
                        : null}
                </fieldset>
            </form>
        </li>;
    }
}

class Will extends React.Component {
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

        this.setState({waiting: true});
        this.props.client.request('will', this.refs.will.getValue()).then(
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
        return <form onSubmit={this.onSubmit.bind(this)}><fieldset disabled={this.state.waiting}>
            <h4>
                Will
                {!this.state.editing
                    ? <small><button type="button" className="btn-link glyphicon glyphicon-pencil" onClick={this.startEdit.bind(this)}></button></small>
                    : <span> <button type="submit" className="btn btn-primary">Save</button> <button type="button" className="btn btn-default" onClick={this.onCancel.bind(this)}>Cancel</button></span>}
            </h4>
            {!this.state.editing
                ? this.props.will !== ''
                    ? <blockquote dangerouslySetInnerHTML={{__html: REMARKABLE.render(this.props.will)}}></blockquote>
                    : <em>You are currently not leaving a will.</em>
                : <div className="form-group">
                    <CodeMirror ref="will" defaultValue={this.props.will} defaultOptions={{
                        viewportMargin: Infinity,
                        lineNumbers: true,
                        autofocus: true,
                        mode: 'markdown',
                        theme: 'default'
                    }}/>
                    <p className="help-block">You may use <a href="http://commonmark.org/help/" target="markdown-help">Markdown</a> to format your text.</p>
                </div>}
        </fieldset></form>;
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
                                   onSave={this.props.canEditAction(i) && this.props.onActionSave !== null ? this.props.onActionSave.bind(this, i) : null}
                                   annotation={interpreted !== null ? interpreted.description : null}
                                   buttonCaption={this.props.saveButtonCaption}
                                   buttonClass={this.props.saveButtonClass} />;
                })}
            </ul>

            {extra.length > 0
                ? <div>
                    <p>You also received:</p>
                    <ul>{extra.map((e, i) => {
                        let interpreted = interpretInfo(e);
                        return <li key={i}><strong>{interpreted.name}:</strong> {interpreted.description}</li>;
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
            {this.heading("Day", this.props.lynchOnConsensusMet ? 'or on consensus' : '')}
            {this.props.deaths.length > 0
                ? this.props.deaths.map(player =>
                    <Death key={player.name} player={player} reason="died" />)
                : null}
            <p><strong>Consensus required:</strong> {{
                MostVotes: 'The player with the most votes will be lynched.',
                StrictMajority: 'The player for whom the strict majority of votes are for will be lynched.'
            }[this.props.consensus]}</p>
            <ul>
                {Object.keys(this.props.ballot.votes).sort().map((e, i) => {
                    let target = this.props.ballot.votes[e];
                    return <Vote key={e}
                                 canEdit={!this.isPrimaryEnding()}
                                 client={this.props.client}
                                 source={e}
                                 target={target}
                                 me={this.props.me}
                                 candidates={this.props.ballot.candidates} />
                })}
            </ul>

            {this.props.plan.length > 0
                ? <div>
                    <p>Additionally, the following <strong>instantaneous</strong> actions are available, so choose carefully if you want to use one!</p>
                    <Plan plan={this.props.plan}
                          onActionSave={!this.isTwilightEnding() ? this.onActionSave.bind(this) : null}
                          canEditAction={(i) => this.props.plan[i].targets === null}
                          messages={this.props.messages}
                          saveButtonClass='danger'
                          saveButtonCaption='Perform' />
                </div>
                : null}

            {!this.props.dead ? <Will client={this.props.client} will={this.props.will} /> : null}
        </div>;
    }
}

class Death extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            showingWill: false
        };
    }

    toggleWill() {
        this.setState({showingWill: !this.state.showingWill});
    }

    render() {
        return <div>
            <p>
                <strong>{this.props.player.name}</strong> the <strong>{this.props.player.fullRole}</strong> {this.props.reason}.
                {this.props.player.will !== ''
                    ? <button type="button" onClick={this.toggleWill.bind(this)} className="btn-link" href="#">{this.state.showingWill ? 'Hide will' : 'Show will'}</button>
                    : <span> No will was found.</span>}
            </p>
            {this.state.showingWill
                ? <blockquote>
                    <div dangerouslySetInnerHTML={{__html: REMARKABLE.render(this.props.player.will)}}></div>
                    <footer>The last will and testament of <cite>{this.props.player.name}</cite></footer>
                </blockquote>
                : null}
        </div>;
    }
}

class DayResult extends React.Component {
    render() {
        return <div>
            <h3>Day {this.props.turn} <small>ended</small></h3>
            {this.props.lynched !== null
                ? <Death player={this.props.lynched} reason="was lynched" />
                : <p>Nobody was lynched.</p>}
            {this.props.deaths.length > 0
                ? this.props.deaths.map(player =>
                    <Death key={player.name} player={player} reason="died" />)
                : null}
            <ul>
                {Object.keys(this.props.votes).sort().map((e) => {
                    let target = this.props.votes[e];
                    return <li key={e}><strong>{e}</strong> voted for {target === null ? <em>no one</em> : <strong>{target}</strong>}</li>;
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
                  onActionSave={!this.isPrimaryEnding() ? this.onActionSave.bind(this) : null}
                  messages={[]}
                  saveButtonClass='primary'
                  saveButtonCaption='Plan' />
            {!this.props.dead ? <Will client={this.props.client} will={this.props.will} /> : null}
        </div>;
    }
}

class NightResult extends React.Component {
    render() {
        return <div>
            <h3>Night {this.props.turn} <small>ended</small></h3>
            {this.props.deaths.length > 0
                ? this.props.deaths.map(player =>
                    <Death key={player.name} player={player} reason="was found dead" />)
                : <p>Nobody died.</p>}

            <Plan plan={this.props.plan}
                  canEditAction={(i) => false}
                  onActionSave={null}
                  messages={this.props.messages} />
        </div>;
    }
}

function onKeys(f) {
    return (a, b) => {
        let keysA = f(a);
        let keysB = f(b);

        for (let i = 0; i < keysA.length; ++i) {
            if (keysA[i] < keysB[i]) {
                return -1;
            }

            if (keysA[i] > keysB[i]) {
                return 1;
            }
        }

        return 0;
    };
}

class Profile extends React.Component {
    render() {
        return <div>
            <h2 style={{textDecoration: this.props.players[this.props.name] === null ? null : 'line-through'}}>{this.props.name}</h2>
            <dl>
                <dt>Role</dt>
                <dd>{this.props.fullRole}</dd>

                <dt>Faction</dt>
                <dd>{this.props.faction}</dd>

                <dt>Abilities</dt>
                <dd>{this.props.abilities}</dd>

                <dt>Agenda</dt>
                <dd>{this.props.agenda}</dd>

                <dt>Friends</dt>
                <dd>
                    {this.props.friends.length > 0 ? <ul>
                        {this.props.friends.sort(onKeys(name => [this.props.players[name] === null ? 0 : 1, name])).map(name => {
                            let player = this.props.players[name];
                            return <li key={name}>{player === null
                                ? name
                                : <span><del>{name}</del><br/><small>{player.fullRole}</small></span>}</li>;
                        })}
                    </ul> : 'none'}
                </dd>

                <dt>Cohorts</dt>
                <dd>
                    {this.props.cohorts.length > 0 ? <ul>
                        {this.props.cohorts.sort(onKeys(name => [name === null || this.props.players[name] === null ? 0 : 1, name])).map((name, i) => {
                            if (name === null) {
                                return <li key={i}><em>someone</em></li>;
                            } else {
                                let player = this.props.players[name];
                                return <li key={name}>{player === null
                                    ? name
                                    : <span><del>{name}</del><br/><small>{player.fullRole}</small></span>}</li>;
                            }
                        })}
                    </ul> : 'none'}
                </dd>

                <dt>Players</dt>
                <dd>
                    <ul>
                        {Object.keys(this.props.players).sort(onKeys(name => [this.props.players[name] === null ? 0 : 1, name])).map(name => {
                            let player = this.props.players[name];
                            return <li key={name}>{player === null
                                ? name
                                : <span><del>{name}</del><br/><small>{player.fullRole}</small></span>}</li>;
                        })}
                    </ul>
                </dd>
            </dl>
        </div>;
    }
}

class Start extends React.Component {
    render() {
        return <div>
            <h3>Start</h3>
            <div dangerouslySetInnerHTML={{__html: REMARKABLE.render(this.props.motd)}}></div>
        </div>;
    }
}

class End extends React.Component {
    constructor(props) {
        super(props);
        this.state = {showExecuted: false};
    }

    toggleView() {
        this.setState({showExecuted: !this.state.showExecuted});
    }

    render() {
        let view = this.state.showExecuted
            ? this.props.log
            : this.props.planned;

        return <div>
            <h3>End</h3>
            <p>{this.props.winners.indexOf(this.props.me) !== -1
                ? 'Congratulations!'
                : 'Better luck next time!'}
            </p>

            {this.props.winners.length > 0
                ? <div>
                    <p>The winners are:</p>
                    <ul>
                        {this.props.winners.sort().map(e => <li key={e}>{e}</li>)}
                    </ul>
                </div>
                : <p>Everyone lost!</p>}

            <h4>Roles</h4>
            <ul>
                {Object.keys(this.props.players).sort().map(name => {
                    let player = this.props.players[name];
                    return <li key={name}><strong>{name}</strong>: {player.fullRole}</li>;
                })}
            </ul>
            <h4>Action Log <small><button type="button" onClick={this.toggleView.bind(this)} className="btn-link">{this.state.showExecuted
                    ? 'Switch to planned view'
                    : 'Switch to executed view'}</button></small></h4>

            {this.state.showExecuted
                ? <p>
                    <strong>Executed view:</strong>{' '}
                    These are the actions that occured at night with their
                    actual targets. Note that they may not be the actions
                    originally planned by each player (or even planned at all),
                    not in order of actual execution (bus drives may appear
                    after bus driven actions, for instance), and some may be
                    missing (if they were blocked). However, all actions present
                    are guaranteed to be executed.
                </p>
                : <p>
                    <strong>Planned view:</strong>{' '}
                    These are the actions that were planned by players, as-is.
                    Note that they do not take into account actions that were
                    blocked or otherwise altered, and are not in any specific
                    order.
                </p>}

            {view.map((e, i) => <div key={i}>
                <h5>{e.phase} {e.turn}</h5>
                <ul>{e.acts.length > 0 ? e.acts.map((e, i) => {
                    return <li key={i}><strong>{e.source}</strong>: {parseCommand(e.command).parts.map((part, i) => {
                        switch (part.type) {
                            case "text":
                                return <span key={i}>{part.text}</span>;

                            case "group":
                                return <span key={i}><strong>{e.targets[part.group]}</strong></span>;
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
        this.onError = () => {};

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
        let qs = querystring.parse(window.location.search.substring(1));
        this.id = jwtDecode(qs.token).t;

        this.seqNum = 0;
        this.socket = new WebSocket('ws://' + window.location.host + '/ws?' +
                                    querystring.stringify(qs));

        this.socket.onopen = () => {
            this.resetBackoff();
            this.onOpen();
        };

        this.socket.onmessage = (e) => {
            let payload = JSON.parse(e.data);
            let body = payload.body;

            if (payload.id !== this.id) {
                this.onError("Please notify the administrator if you get this error.");
                this.socket.close();
                return;
            }

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

                case 'refresh':
                    window.location.reload();
                    break;
            }
        };

        this.promises = {};
        this.socket.onclose = (e) => {
            if (e.code === 4000) {
                this.onError(e.reason);
                return;
            }

            this.onClose();

            if (!e.wasClean) {
                window.setTimeout(() => {
                    this.connect();
                    this.stepBackoff();
                }, this.nextReconnect);
            }
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
            connected: false,
            error: null
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
                playerState: end.playerState,
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
        this.client.onError = (reason) => {
            this.setState({connected: false, error: reason});
        };
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.ready) {
            document.title = this.state.publicInfo.name;
        }
    }

    render() {
        if (this.state.error !== null) {
            return <div className="container">
                <div className="alert alert-danger">Permanently disconnected from server: {this.state.error}</div>
            </div>;
        }

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

        let dead = this.state.publicState.players[this.state.playerState.name] !== null;

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
                               end={this.state.phaseState.end}
                               twilightDuration={0}
                               plan={this.state.phaseState.plan}
                               will={this.state.will}
                               dead={dead}
                               players={this.state.publicState.players} /> :
                     this.state.phaseState.phase == 'Day' ?
                        <Day client={this.client}
                             turn={this.state.publicState.turn}
                             end={this.state.phaseState.end}
                             twilightDuration={this.state.publicInfo.twilightDuration}
                             consensus={this.state.publicInfo.consensus}
                             lynchOnConsensusMet={this.state.publicInfo.lynchOnConsensusMet}
                             plan={this.state.phaseState.plan}
                             will={this.state.will}
                             dead={dead}
                             players={this.state.publicState.players}
                             me={this.state.playerState.name}
                             ballot={this.state.phaseState.ballot}
                             deaths={this.state.phaseState.deaths}
                             messages={this.state.phaseState.messages} /> :
                        <End winners={this.state.phaseState.winners}
                             log={this.state.phaseState.log}
                             planned={this.state.phaseState.planned}
                             players={this.state.phaseState.players}
                             me={this.state.playerState.name} />}
                    {results}
                    <Start motd={this.state.publicInfo.motd} />
                </div>

                <div className="col-md-2 col-md-pull-10">
                    <Profile name={this.state.playerState.name}
                             fullRole={this.state.playerState.fullRole}
                             abilities={this.state.playerState.abilities}
                             faction={this.state.playerState.faction}
                             agenda={this.state.playerState.agenda}
                             friends={this.state.playerState.friends}
                             cohorts={this.state.playerState.cohorts}
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
