import deepEqual from 'deep-equal';
import React from 'react';
import ReactDOM from 'react-dom';
import CodeMirror from './react-codemirror.jsx';
import {IntlProvider, FormattedMessage, addLocaleData} from 'react-intl';
import Remarkable from 'remarkable';
import jwtDecode from 'jwt-decode';
import querystring from 'querystring';
import {} from 'codemirror/mode/markdown/markdown';

import translations from './translations';

const QS = querystring.parse(window.location.search.substring(1));

const REMARKABLE = new Remarkable('commonmark', {
    html: false,
    breaks: true
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

const INFO_INTERPRETATIONS = {
    GulitInfo: (info) => ({
        name: <FormattedMessage {...translations['message.guilt.title']} />,
        description: info.isGuilty
            ? <FormattedMessage {...translations['message.guilt.positive']} />
            : <FormattedMessage {...translations['message.guilt.negative']} />
    }),

    PlayersInfo: (info) => ({
        name: <FormattedMessage {...translations['message.players.title']} />,
        description: info.players.length > 0
            ? intersperse(info.players.map(player => <span key={player}>{player}</span>),
                          () => ', ')
            : <em><FormattedMessage {...translations['message.players.negative']} /></em>
    }),

    ActionsInfo: (info) => ({
        name: <FormattedMessage {...translations['message.actions.title']} />,
        description: info.actions.length > 0
            ? intersperse(info.actions.map((command, i) => parseCommand(command).parts.map((part, i) => {
                switch (part.type) {
                    case "text":
                        return <span key={i}>{part.text}</span>;

                    case "group":
                        return <FormattedMessage {...translations['placeholder.someone']} key={i} />;
                }
            })), () => ', ')
            : <em><FormattedMessage {...translations['message.actions.negative']} /></em>
    }),

    FruitInfo: (info) => ({
        name: <FormattedMessage {...translations['message.fruit.title']} />,
        description: <FormattedMessage {...translations['message.fruit.description']} />
    }),

    RoleInfo: (info) => ({
        name: <FormattedMessage {...translations['message.role.title']} />,
        description: info.role
    }),

    GreetingInfo: (info) => ({
        name: <FormattedMessage {...translations['message.greeting.title']} />,
        description: <FormattedMessage {...translations['message.greeting.description']}
                                       values={{greeter: <strong>{info.greeter}</strong>,
                                                faction: <strong>{info.faction}</strong>}} />
    }),
};

function interpretInfo(info) {
    return INFO_INTERPRETATIONS[info.type](info);
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

    startEdit(e) {
        e.preventDefault();
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
                                <FormattedMessage {...translations['placeholder.noOne']}>{(message) => <option value="">{message}</option>}</FormattedMessage>
                                {this.props.action.candidates[part.group].sort().map(candidate =>
                                    <option value={candidate} key={candidate}>{candidate}</option>)}
                            </select>;
                        } else {
                            return targets === null
                                ? <em key={i}>{this.props.action.compulsion !== 'Forced'
                                    ? <FormattedMessage {...translations['placeholder.noOne']} />
                                    : <FormattedMessage {...translations['placeholder.someone']} />}</em>
                                : <strong key={i}>{targets[part.group]}</strong>;
                        }
                }
            });
        } else {
            editor = <span>
                {this.props.action.command} {editMode
                    ? <input type="checkbox" defaultChecked={this.props.action.targets !== null} name='on' />
                    : this.props.action.targets !== null
                        ? <span> <strong><FormattedMessage {...translations['action.value.true']} /></strong></span>
                        : <span> <em><FormattedMessage {...translations['action.value.false']} /></em></span>}
            </span>;
        }

        return <li>
            <form onSubmit={this.onSubmit.bind(this)}>
                <fieldset disabled={!this.props.action.available || this.state.waiting}>
                    <div className="form-inline">
                        <div className="form-group" style={{textDecoration: !this.props.action.available ? 'line-through' : ''}}>
                            {editor}{this.props.action.compulsion === 'Forced'
                                ? <em><FormattedMessage {...translations['action.compulsion.forced']} /></em>
                                : this.props.action.compulsion === 'Required'
                                    ? <em><FormattedMessage {...translations['action.compulsion.required']} /></em>
                                    : null}
                            {this.props.annotation ? <span> ⇒ {this.props.annotation}</span> : null}
                            {!this.state.editing && this.props.action.available && this.props.action.compulsion !== 'Forced' && this.props.onSave !== null
                                ? <span> <a href="#" className="glyphicon glyphicon-pencil" onClick={this.startEdit.bind(this)}></a></span>
                                : null}
                        </div>

                        {editMode
                            ? <span> <button type="submit" className={"btn btn-" + this.props.buttonClass}>{this.props.buttonCaption}</button> <button onClick={this.onCancel.bind(this)} type="button" className="btn btn-default"><FormattedMessage {...translations['action.form.cancel']} /></button></span>
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

var Phase = (translationKey, Body) => class extends React.Component {
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

    render() {
        return <div>
            <h3><FormattedMessage {...translations[translationKey]} values={{turn: this.props.turn}} /> <small>{
            !this.isPrimaryEnding()
                ? (this.props.endOnConsensusMet
                    ? <FormattedMessage {...translations['phase.ending.primaryOrConsensus']}
                                        values={{timeLeft: this.formatDuration(this.getPrimaryTimeLeft())}} />
                    : <FormattedMessage {...translations['phase.ending.primary']}
                                        values={{timeLeft: this.formatDuration(this.getPrimaryTimeLeft())}} />)
                : !this.isTwilightEnding()
                    ? <FormattedMessage {...translations['phase.ending.twilight']}
                                        values={{timeLeft: this.formatDuration(this.getTwilightTimeLeft())}} />
                    :  <FormattedMessage {...translations['phase.ending.now']} />}</small></h3>
            <Body {...this.props}
                  isPrimaryEnding={this.isPrimaryEnding()}
                  isTwilightEnding={this.isTwilightEnding()} />
        </div>
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

    startEdit(e) {
        e.preventDefault();
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
        return <form onSubmit={this.onSubmit.bind(this)}>
            <fieldset disabled={this.state.waiting}>
                <div className="form-inline">
                    <div className="form-group">
                        <label htmlFor="vote-target"><strong><FormattedMessage {...translations['vote.yourVote']} /></strong></label> {this.state.editing
                            ? <select className="form-control" defaultValue={this.props.target === null ? "" : this.props.target} name="target" id="vote-target">
                                <FormattedMessage {...translations['placeholder.noOne']}>{(message) => <option value="">{message}</option>}</FormattedMessage>
                                {this.props.candidates.map(candidate =>
                                    <option value={candidate} key={candidate}>{candidate}</option>)}
                            </select>
                            : this.props.target === null
                                ? <span><em><FormattedMessage {...translations['vote.abstain']} /></em></span>
                                : <span><strong>{this.props.target}</strong></span>}
                        {!this.state.editing && this.props.canEdit
                            ? <span> <a href="#" className="glyphicon glyphicon-pencil" onClick={this.startEdit.bind(this)}></a></span>
                            : null}
                    </div>

                    {this.state.editing && this.props.canEdit
                        ? <span> <button type="submit" className="btn btn-primary"><FormattedMessage {...translations['vote.form.save']} /></button> <button onClick={this.onCancel.bind(this)} type="button" className="btn btn-default"><FormattedMessage {...translations['vote.form.cancel']} /></button></span>
                        : null}
                </div>

                {this.state.editing && this.props.canEdit
                    ? <p className="help-block"><FormattedMessage {...translations['vote.help']} /></p>
                    : null}
            </fieldset>
        </form>;
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

    startEdit(e) {
        e.preventDefault();
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
                <FormattedMessage {...translations['will.title']} />
                {!this.state.editing
                    ? <span> <small><a href="#" className="glyphicon glyphicon-pencil" onClick={this.startEdit.bind(this)}></a></small></span>
                    : <span> <button type="submit" className="btn btn-primary"><FormattedMessage {...translations['will.form.save']} /></button> <button type="button" className="btn btn-default" onClick={this.onCancel.bind(this)}><FormattedMessage {...translations['will.form.cancel']} /></button></span>}
            </h4>
            {!this.state.editing
                ? this.props.will !== ''
                    ? <blockquote dangerouslySetInnerHTML={{__html: REMARKABLE.render(this.props.will)}}></blockquote>
                    : <em><FormattedMessage {...translations['will.notLeavingWill']} /></em>
                : <div className="form-group">
                    <CodeMirror ref="will" defaultValue={this.props.will} defaultOptions={{
                        viewportMargin: Infinity,
                        lineNumbers: true,
                        autofocus: true,
                        mode: 'markdown',
                        theme: 'default'
                    }}/>
                    <p className="help-block"><FormattedMessage {...translations['will.help']}
                                                                values={{formattingHelpLink: <a href="http://commonmark.org/help/" target="markdown-help">Markdown</a>}} /></p>
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

function intersperse(arr, sepf) {
    if (arr.length === 0) {
        return [];
    }

    return arr.slice(1).reduce(function(xs, x, i) {
        return xs.concat([sepf(i), x]);
    }, [arr[0]]);
}

class Ballot extends React.Component {
    render() {
        let voted = {};
        let abstentions = [];
        let noVotes = [];

        let voters = Object.keys(this.props.votes).sort();

        voters.forEach(voter => {
            voted[voter] = [];
        });

        voters.forEach(voter => {
            let votee = this.props.votes[voter];
            if (votee === null) {
                abstentions.push(voter);
            } else {
                voted[votee].push(voter);
            }
        });

        voters.forEach(voter => {
            if (voted[voter].length === 0) {
                noVotes.push(voter);
            }
        });

        return <div>
            <h4><FormattedMessage {...translations['ballot.title']} /></h4>
            {Object.prototype.hasOwnProperty.call(this.props.votes, this.props.me)
                ? <Vote canEdit={this.props.canEdit}
                        target={this.props.votes[this.props.me]}
                        candidates={voters}
                        client={this.props.client} />
                : null}

            <p><strong><FormattedMessage {...translations['ballot.consensus.title']} /></strong> {{
                MostVotes: <FormattedMessage {...translations['ballot.consensus.criteria.mostVotes']} />,
                StrictMajority: <FormattedMessage {...translations['ballot.consensus.criteria.strictMajority']}
                                                  values={{numVotesRequired: Math.floor(voters.length / 2 + 1)}} />
            }[this.props.consensus]}</p>

            <p><FormattedMessage {...translations['ballot.votes.title']} /></p>

            {Object.keys(voted).sort(onKeys(name => [-voted[name].length, name])).map(e => {
                let votes = voted[e];

                if (votes.length === 0) {
                    return null;
                }

                return <div key={e}>
                    <h5><FormattedMessage {...translations['ballot.votes.against']} values={{name: <strong>{e}</strong>}} /> <span className="badge">{votes.length}</span></h5>
                    <ul>
                        {votes.map(voter => <li key={voter}><strong>{voter}</strong></li>)}
                    </ul>
                </div>;
            })}

            <div>
                <h5><em><FormattedMessage {...translations['ballot.abstentions.title']} /></em></h5>
                <ul>
                    {abstentions.length > 0
                        ? abstentions.map(voter => <li key={voter}><strong>{voter}</strong></li>)
                        : <li><em><FormattedMessage {...translations['ballot.abstentions.none']} /></em></li>}
                </ul>
            </div>

            <div>
                <FormattedMessage {...translations['ballot.votes.notAgainst']} values={{names: <span>{intersperse(noVotes.map(voter => <strong key={voter}>{voter}</strong>), () => ', ')}</span>}} />
            </div>
        </div>;
    }
}

var Day = Phase('phase.title.day', class extends React.Component {
    shouldComponentUpdate(nextProps, nextState) {
        return !deepEqual(this.props, nextProps);
    }

    onActionSave(i, targets) {
        return this.props.client.request('impulse', {i: i, targets: targets});
    }

    render() {
        return <div>
            {this.props.deaths.length > 0
                ? this.props.deaths.sort(onKeys(player => [player.name])).map(player =>
                    <Death key={player.name} player={player} reason="died" />)
                : null}

            {this.props.plan.length > 0
                ? <div>
                    <h4><FormattedMessage {...translations['phase.actions.title']} /></h4>
                    <p><FormattedMessage {...translations['phase.actions.instantaneous']} /></p>
                    <Plan plan={this.props.plan}
                          onActionSave={!this.props.isTwilightEnding ? this.onActionSave.bind(this) : null}
                          canEditAction={(i) => this.props.plan[i].targets === null}
                          messages={this.props.messages}
                          saveButtonClass='danger'
                          saveButtonCaption='Perform' />
                </div>
                : null}

            <Ballot votes={this.props.ballot.votes}
                    consensus={this.props.consensus}
                    canEdit={!this.props.isPrimaryEnding}
                    me={this.props.me}
                    client={this.props.client} />

            {!this.props.dead ? <Will client={this.props.client} will={this.props.will} /> : null}
        </div>;
    }
});

class Death extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            showingWill: false
        };
    }

    toggleWill(e) {
        e.preventDefault();
        this.setState({showingWill: !this.state.showingWill});
    }

    render() {
        return <div>
            <p>
                <FormattedMessage {...translations[this.props.player.modKillReason === null ? this.props.reason : 'death.reason.modkilled']}
                                  values={{name: <strong>{this.props.player.name}</strong>,
                                           role: <strong>{this.props.player.fullRole}</strong>}} />{' '}
                {this.props.player.modKillReason === null
                    ? this.props.player.will !== ''
                        ? <a onClick={this.toggleWill.bind(this)} href="#">{this.state.showingWill
                            ? <FormattedMessage {...translations['death.will.showing']} />
                            : <FormattedMessage {...translations['death.will.hidden']} />}</a>
                        : <FormattedMessage {...translations['death.will.none']} />
                    : <FormattedMessage {...translations['death.will.modkilled']} />}
            </p>
            {this.state.showingWill
                ? <blockquote>
                    <div dangerouslySetInnerHTML={{__html: REMARKABLE.render(this.props.player.will)}}></div>
                    <footer><FormattedMessage {...translations['death.will.footer']} values={{name: <cite>{this.props.player.name}</cite>}} /></footer>
                </blockquote>
                : null}
        </div>;
    }
}

class DayResult extends React.Component {
    render() {
        return <div>
            <h3><FormattedMessage {...translations['phase.title.day']} values={{turn: this.props.turn}} /> <small><FormattedMessage {...translations['phase.ending.ended']} /></small></h3>
            {this.props.lynched !== null
                ? <Death player={this.props.lynched} reason="death.reason.lynched" />
                : <p><FormattedMessage {...translations['death.reason.noLynch']} /></p>}
            {this.props.deaths.length > 0
                ? this.props.deaths.sort(onKeys(player => [player.name])).map(player =>
                    <Death key={player.name} player={player} reason="death.reason.died" />)
                : null}

            {this.props.plan.length > 0
                ? <div>
                    <h4><FormattedMessage {...translations['phase.actions.title']} /></h4>
                    <p><FormattedMessage {...translations['phase.actions.wereInstantaneous']} /></p>
                    <Plan plan={this.props.plan}
                          canEditAction={(i) => false}
                          onActionSave={null}
                          messages={this.props.messages} />
                </div>
                : null}

            <Ballot votes={this.props.votes}
                   consensus={this.props.consensus}
                   canEdit={false}
                   me={this.props.me}
                   client={null} />
        </div>;
    }
}

var Night = Phase('phase.title.night', class extends React.Component {
    shouldComponentUpdate(nextProps, nextState) {
        return !deepEqual(this.props, nextProps);
    }

    onActionSave(i, targets) {
        return this.props.client.request('plan', {i: i, targets: targets});
    }

    render() {
        return <div>
            {this.props.deaths.length > 0
                ? this.props.deaths.sort(onKeys(player => [player.name])).map(player =>
                    <Death key={player.name} player={player} reason="death.reason.died" />)
                : null}

            {this.props.plan.length > 0
                ? <div>
                    <h4><FormattedMessage {...translations['phase.actions.title']} /></h4>
                    <p><FormattedMessage {...translations['phase.actions.available']} /></p>
                    <Plan plan={this.props.plan}
                          canEditAction={(i) => true}
                          onActionSave={!this.props.isPrimaryEnding ? this.onActionSave.bind(this) : null}
                          messages={[]}
                          saveButtonClass='primary'
                          saveButtonCaption='Plan' />
                </div>
                : null}
            {!this.props.dead ? <Will client={this.props.client} will={this.props.will} /> : null}
        </div>;
    }
});

class NightResult extends React.Component {
    render() {
        return <div>
            <h3><FormattedMessage {...translations['phase.title.night']} values={{turn: this.props.turn}} /> <small><FormattedMessage {...translations['phase.ending.ended']} /></small></h3>
            {this.props.deaths.length > 0
                ? this.props.deaths.sort(onKeys(player => [player.name])).map(player =>
                    <Death key={player.name} player={player} reason="death.reason.foundDead" />)
                : <p><FormattedMessage {...translations['death.reason.noneFoundDead']} /></p>}

            {this.props.plan.length > 0
                ? <div>
                    <h4><FormattedMessage {...translations['phase.actions.title']} /></h4>
                    <p><FormattedMessage {...translations['phase.actions.wereAvailable']} /></p>
                    <Plan plan={this.props.plan}
                          canEditAction={(i) => false}
                          onActionSave={null}
                          messages={this.props.messages} />
                </div>
                : null}
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
                <dt><FormattedMessage {...translations['profile.role']} /></dt>
                <dd>{this.props.fullRole}</dd>

                <dt><FormattedMessage {...translations['profile.faction']} /></dt>
                <dd>{this.props.faction}</dd>

                <dt><FormattedMessage {...translations['profile.abilities']} /></dt>
                <dd>{this.props.abilities}</dd>

                <dt><FormattedMessage {...translations['profile.agenda']} /></dt>
                <dd>
                    <ul>
                        {this.props.factionIsPrimary ? <li><FormattedMessage {...translations['agenda.primary']} /></li> : null}
                        {this.props.agenda !== null ? <li>{this.props.agenda}</li> : null}
                    </ul>
                </dd>

                <dt><FormattedMessage {...translations['profile.friends']} /></dt>
                <dd>
                    <ul>
                    {this.props.friends.length > 0
                        ? this.props.friends.sort(onKeys(name => [this.props.players[name] === null ? 0 : 1, name])).map(name => {
                            let player = this.props.players[name];
                            return <li key={name}>{player === null
                                ? name
                                : <span><del>{name}</del><br/><small>{player.fullRole}</small></span>}</li>;
                        })
                        : <li><em><FormattedMessage {...translations['placeholder.noOne']} /></em></li>}
                    </ul>
                </dd>

                <dt><FormattedMessage {...translations['profile.cohorts']} /></dt>
                <dd>
                    <ul>
                    {this.props.cohorts.length > 0
                        ? this.props.cohorts.sort(onKeys(name => [name === null || this.props.players[name] === null ? 0 : 1, name])).map((name, i) => {
                            if (name === null) {
                                return <li key={i}><em><FormattedMessage {...translations['placeholder.someone']} /></em></li>;
                            } else {
                                let player = this.props.players[name];
                                return <li key={name}>{player === null
                                    ? name
                                    : <span><del>{name}</del><br/><small>{player.fullRole}</small></span>}</li>;
                            }
                        })
                        : <li><em><FormattedMessage {...translations['placeholder.noOne']} /></em></li>}
                    </ul>
                </dd>

                <dt><FormattedMessage {...translations['profile.players']} /> <span className="badge">{Object.keys(this.props.players).filter(name => this.props.players[name] === null).length}</span></dt>
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
            <h3><FormattedMessage {...translations['phase.title.start']} /></h3>
            <div dangerouslySetInnerHTML={{__html: REMARKABLE.render(this.props.motd)}}></div>
        </div>;
    }
}

class LogEntry extends React.Component {
    present(act) {
        return <span><strong>{act.source}</strong>: {parseCommand(act.command).parts.map((part, i) => {
            switch (part.type) {
                case "text":
                    return <span key={i}>{part.text}</span>;

                case "group":
                    return <span key={i}><strong>{act.targets[part.group]}</strong></span>;
            }
        })}</span>;
    }

    render() {
        let triggerKeys = Object.keys(this.props.entry.triggers).sort();

        return <li><div>{this.props.entry.final !== null
            ? this.props.entry.planned === null
                ? this.present(this.props.entry.final)
                : <div>
                    <div><del>{this.present(this.props.entry.planned)}</del> <FormattedMessage {...translations['actionLog.entry.hint.altered']} /></div>
                    <div>{this.present(this.props.entry.final)}</div>
                </div>
            : <div><del>{this.present(this.props.entry.planned)}</del> <FormattedMessage {...translations['actionLog.entry.hint.blocked']} /></div>
        }</div>{triggerKeys.length > 0
            ? <div>
                <em><FormattedMessage {...translations['actionLog.entry.caused']} /></em>
                <ul>
                    {triggerKeys.map(key => <LogEntry key={key} entry={this.props.entry.triggers[key]} />)}
                </ul>
            </div>
            : null}</li>;
    }
}

class End extends React.Component {
    render() {
        return <div>
            <h3><FormattedMessage {...translations['phase.title.end']} /></h3>
            <p>{this.props.winners.indexOf(this.props.me) !== -1
                ? <FormattedMessage {...translations['end.result.win']} />
                : <FormattedMessage {...translations['end.result.loss']} />}
            </p>

            {this.props.winners.length > 0
                ? <div>
                    <p><FormattedMessage {...translations['end.winners.title']} /></p>
                    <ul>
                        {this.props.winners.sort().map(e => <li key={e}>{e}</li>)}
                    </ul>
                </div>
                : <p><FormattedMessage {...translations['end.winners.none']} /></p>}

            <h4><FormattedMessage {...translations['roles.title']} /></h4>
            <ul>
                {Object.keys(this.props.players).sort().map(name => {
                    let player = this.props.players[name];
                    return <li key={name}><strong>{name}</strong>: {player.fullRole}</li>;
                })}
            </ul>

            <h4><FormattedMessage {...translations['actionLog.title']} /></h4>
            <p><FormattedMessage {...translations['actionLog.description']} /></p>

            {Object.keys(this.props.log).sort(onKeys(k => [+k])).map(turn => ['Night', 'Day'].map(phase => {
                let phases = this.props.log[turn];

                if (!Object.prototype.hasOwnProperty.call(phases, phase)) {
                    return;
                }

                let entries = phases[phase];
                let entryKeys = Object.keys(entries).sort(onKeys(k => [+k]));

                return <div key={phase + turn}>
                    <h5>{phase} {turn}</h5>
                    <ul>{entryKeys.length > 0
                        ? entryKeys.map(key => <LogEntry key={key} entry={entries[key]} />)
                        : <li><em><FormattedMessage {...translations['actionLog.entry.nothingHappened']} /></em></li>}</ul>
                </div>;
            }))}
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
        this.id = jwtDecode(QS.token).t;

        this.seqNum = 0;
        this.socket = new WebSocket('ws://' + window.location.host + '/ws?' +
                                    querystring.stringify({token: QS.token}));

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

function loadLocale(locale, cb) {
    let lang = locale.split(/-/)[0];
    try {
        require.context('bundle!react-intl/locale-data')('./' + lang)((localeData) => {
            addLocaleData(localeData);
            try {
                require.context('bundle!./translations', false, /^\.\/(?!whitelist_).*\.json$/)('./' + locale + '.json')(cb);
            } catch (e) {
                console.error('Error while loading messages for locale ' + locale + ':', e);
                cb({});
            }
        });
    } catch (e) {
        console.error('Error while loading locale data for language ' + lang + ':', e);
        cb({});
    }
}

class Root extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            ready: false,
            locale: QS.lang || navigator.language,
            messages: {},
            connected: false,
            error: null
        };
    }

    componentWillMount() {
        this.client = new Client();
    }

    componentDidMount() {
        this.client.onRootMessage = root => {
            let lastLocale = this.state.locale;
            this.setState(root);
            let locale = QS.lang || (root.publicInfo ? root.publicInfo.locale : null) || navigator.language;

            // If our locale changed, we need to load new locale messages.
            if (!this.state.ready || locale !== lastLocale) {
                loadLocale(locale, messages => {
                    this.setState({
                        locale: locale,
                        messages: messages,
                        ready: true
                    });
                });
            }
        };

        this.client.onPhaseEndMessage = end => {
            let state = {
                publicState: end.publicState,
                playerState: end.playerState,
                phaseState: end.phaseState,
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
        return <IntlProvider locale={this.state.locale} messages={this.state.messages}>
            <div lang={this.state.locale}>{this.renderBody()}</div>
        </IntlProvider>;
    }

    renderBody() {
        if (this.state.error !== null) {
            return <div className="container">
                <div className="alert alert-danger"><FormattedMessage {...translations['error.permanent']} values={{reason: this.state.error}} /></div>
            </div>;
        }

        if (!this.state.ready) {
            return <div><FormattedMessage {...translations['loading']} /></div>;
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
                                        votes={result.ballot.votes}
                                        consensus={this.state.publicInfo.consensus}
                                        me={this.state.playerState.name} />);
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
                ? <div className="alert alert-warning"><FormattedMessage {...translations['error.temporary']} /></div>
                : null}

            <div className="row">
                <div className="col-md-10 col-md-push-2">
                    {this.state.phaseState.phase == 'Night' ?
                        <Night client={this.client}
                               turn={this.state.publicState.turn}
                               end={this.state.phaseState.end}
                               twilightDuration={0}
                               endOnConsensusMet={false}
                               plan={this.state.phaseState.plan}
                               will={this.state.will}
                               dead={dead}
                               players={this.state.publicState.players}
                               deaths={this.state.phaseState.deaths} /> :
                     this.state.phaseState.phase == 'Day' ?
                        <Day client={this.client}
                             turn={this.state.publicState.turn}
                             end={this.state.phaseState.end}
                             twilightDuration={this.state.publicInfo.twilightDuration}
                             consensus={this.state.publicInfo.consensus}
                             endOnConsensusMet={this.state.publicInfo.endOnConsensusMet}
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
                    <hr />
                    {results.map((result, i) => <div key={i}>
                        {result}
                        <hr />
                    </div>)}
                    <Start motd={this.state.publicInfo.motd} />
                </div>

                <div className="col-md-2 col-md-pull-10">
                    <Profile name={this.state.playerState.name}
                             fullRole={this.state.playerState.fullRole}
                             abilities={this.state.playerState.abilities}
                             faction={this.state.playerState.faction}
                             factionIsPrimary={this.state.playerState.factionIsPrimary}
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
