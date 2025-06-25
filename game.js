// game.js (Corrected & Fully Interactive Version)

// --- 1. DATA REPOSITORY ---
const GAME_DATA = {
    keywords: {
        "Traveller": "This action can target an Actor even if they control Animations.",
        "Brutal": "A `Critical Strike` with this keyword deals 1 additional damage.",
        "Anxious": "This unit cannot perform `Critical Strike`.",
        "Restricted": "This Actor's `Deploy` action costs +1 EN.",
        "Hesitant": "When this unit is defending, its controller cannot discard a card to add to its RV.",
        "Aura": "This attack gains +1 EV.",
        "Siphon": "If this Actor's attack deals damage, remove 1 damage marker from your Actor.",
        "Sticky": "If this Actor's attack deals damage, the target becomes Suppressed.",
    },
    factionModules: {
        "Humanity": [
            { name: "Paragon", type: "Animation", power: 1, focus: 1, keywords: ["Aura", "Restricted", "Traveller"] },
            { name: "Adept", type: "Animation", power: 2, focus: 2, keywords: ["Brutal"] },
        ],
        "Wyverns": [
            { name: "Whelp", type: "Animation", power: 1, focus: 1, keywords: ["Brutal"] },
            { name: "Alpha", type: "Animation", power: 4, focus: 3, keywords: ["Brutal", "Anxious"] },
        ],
    }
};

// --- 2. CORE GAME CLASSES ---
class Deck { constructor(c = []){this.cards=[...c]} shuffle(){for(let i=this.cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.cards[i],this.cards[j]]=[this.cards[j],this.cards[i]]}} draw(c=1){return this.cards.splice(0,c)} add(c){this.cards.unshift(c)} }
class Unit { constructor(d,c){this.id=`u_${Math.random().toString(36).slice(2,11)}`;this.cardData=d;this.controller=c;this.damage=0;this.isSpent=false;this.isSuppressed=false} getHp(){return this.cardData.power||10} getFocus(){return this.cardData.focus||this.controller.focus} getKeywords(){return this.isSuppressed?[]:this.cardData.keywords||[]} isDestroyed(){return this.damage>=this.getHp()} }
class Actor extends Unit { constructor(p){super({name:`${p.name}'s Actor`,type:"Actor"},p)} }
class Player { constructor(n,g){this.name=n;this.game=g;this.hp=10;this.en=10;this.focus=1;this.karma=0;this.damage=0;this.hand=[];this.actor=new Actor(this);this.animations=[]} drawCards(c=1){if(this.game.mainDeck.cards.length<c){this.game.perpetualLibraryRefresh()}const n=this.game.mainDeck.draw(c);this.hand.push(...n)} discardCard(d){const i=this.hand.findIndex(c=>c.name===d.name&&c.power===d.power);if(i>-1){const[c]=this.hand.splice(i,1);this.game.discardPile.add(c);return c}return null} }


// --- 3. THE UI CONTROLLER ---
class UI {
    constructor(game) {
        this.game = game;
        this.elements = {
            p1Board: document.getElementById('player-area'),
            p2Board: document.getElementById('opponent-area'),
            logContent: document.getElementById('log-content'),
            actionsContent: document.getElementById('actions-content'),
            handContent: document.getElementById('hand-content'),
            turnCounter: document.getElementById('turn-counter'),
            phaseStatus: document.getElementById('phase-status'),
            tooltipPopup: document.getElementById('tooltip-popup'),
            tooltipBackdrop: document.getElementById('tooltip-backdrop'),
        };
        this.elements.tooltipBackdrop.addEventListener('click', () => this.hideTooltip());
    }

    log(message) { this.elements.logContent.innerHTML = `<p>> ${message}</p>` + this.elements.logContent.innerHTML; }
    
    render() {
        this.renderPlayerBoard(this.game.players[0], this.elements.p1Board, this.game.players[0] === this.game.currentPlayer);
        this.renderPlayerBoard(this.game.players[1], this.elements.p2Board, this.game.players[1] === this.game.currentPlayer);
        this.elements.turnCounter.textContent = this.game.turn;
        this.elements.phaseStatus.textContent = this.game.phase;
        
        this.renderInteractiveElements();
        this.addEventListeners();
    }

    renderPlayerBoard(player, element, isCurrent) {
        element.innerHTML = `
            <div class="board-area">
                <h3 class="board-title">${player.name} ${isCurrent ? '(Current Turn)' : ''}</h3>
                <p>HP: ${player.hp - player.damage}/${player.hp} | EN: ${player.en} | Focus: ${player.focus} | Karma: ${player.karma}</p>
                <div class="unit-grid">
                    ${this.renderUnit(player.actor)}
                    ${player.animations.map(unit => this.renderUnit(unit)).join('')}
                </div>
            </div>`;
    }

    renderUnit(unit) {
        const classes = ['unit-card'];
        if (unit.isSpent) classes.push('spent');
        if (this.game.isTargetable(unit)) classes.push('targetable');
        const keywordsHTML = this.renderKeywords(unit.getKeywords());
        return `
            <div class="${classes.join(' ')}" data-unit-id="${unit.id}">
                <h4>${unit.cardData.name}</h4>
                <p>HP: ${unit.damage}/${unit.getHp()}</p>
                <p>Focus: ${unit.getFocus()}</p>
                <p>Keywords: ${keywordsHTML}</p> 
                ${unit.isSuppressed ? '<p><b>SUPPRESSED</b></p>' : ''}
            </div>`;
    }

    renderKeywords(keywords) {
        if (!keywords || keywords.length === 0) return "None";
        return keywords.map(kw => `<span class="keyword" data-keyword="${kw}">${kw}</span>`).join(', ');
    }
    
    addEventListeners() {
        document.querySelectorAll('.keyword').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showTooltip(el.dataset.keyword);
            });
        });
        
        document.querySelectorAll('.targetable').forEach(el => {
            el.addEventListener('click', () => {
                this.game.selectTarget(el.dataset.unitId);
            });
        });
    }

    showTooltip(keyword) {
        const definition = GAME_DATA.keywords[keyword] || "No definition found.";
        this.elements.tooltipPopup.innerHTML = `<h4>${keyword}</h4><p>${definition}</p>`;
        this.elements.tooltipPopup.classList.add('tooltip-visible');
        this.elements.tooltipBackdrop.classList.add('tooltip-visible');
    }

    hideTooltip() {
        this.elements.tooltipPopup.classList.remove('tooltip-visible');
        this.elements.tooltipBackdrop.classList.remove('tooltip-visible');
    }
    
    renderInteractiveElements() {
        this.elements.actionsContent.innerHTML = '';
        this.elements.handContent.innerHTML = '';
        if (this.game.phase === 'Action') {
            const unit = this.game.activeUnit;
            if (unit) {
                this.createButton("Pass", () => this.game.passAction(), this.elements.actionsContent);
                this.createButton("Activate", () => this.game.selectAction("Activate"), this.elements.actionsContent);
                if (!unit.getKeywords().includes("Anxious")) {
                    this.createButton("Critical Strike", () => this.game.selectAction("Critical Strike"), this.elements.actionsContent);
                }
            }
        } else if (this.game.phase === 'Fuel') {
            this.game.currentPlayer.hand.forEach(card => {
                if(card.type === "Animation") {
                    this.createButton(`${card.name} (Pwr ${card.power})`, () => this.game.selectFuel(card), this.elements.handContent);
                }
            });
        } else if (this.game.phase === 'Game Over') {
            this.elements.actionsContent.innerHTML = `<h2>GAME OVER</h2>`;
        }
    }

    createButton(text, onClick, parent) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.addEventListener('click', onClick);
        parent.appendChild(btn);
    }
}

// --- 4. THE MAIN GAME ENGINE ---
class Game {
    constructor() {
        this.ui = new UI(this);
        this.players = [new Player("Player 1", this), new Player("Player 2", this)];
        this.turn = 1;
        this.currentPlayerIndex = 0;
        this.phase = "Setup"; // Setup, Action, Fuel, Target, End, Game Over
        this.activeUnit = null;
        this.combatContext = {};
    }
    
    get currentPlayer() { return this.players[this.currentPlayerIndex]; }
    get opponent() { return this.players[(this.currentPlayerIndex + 1) % 2]; }

    start() {
        this.ui.log("Game starting...");
        const allCards = Object.values(GAME_DATA.factionModules).flat();
        this.mainDeck = new Deck(allCards);
        this.mainDeck.shuffle();
        this.discardPile = new Deck();
        this.players.forEach(p => p.drawCards(5));
        
        this.startTurn(); // This will set the first turn's state
        this.ui.render();   // *** THIS IS THE CRITICAL FIX ***
    }
    
    startTurn() {
        this.ui.log(`--- Turn ${this.turn} begins for ${this.currentPlayer.name}. ---`);
        this.currentPlayer.en += this.currentPlayer.focus;
        this.currentPlayer.actor.isSpent = false;
        this.currentPlayer.animations.forEach(u => {
            if (!u.isSuppressed) u.isSpent = false;
        });
        this.findNextActionUnit();
    }
    
    findNextActionUnit() {
        const availableUnits = [this.currentPlayer.actor, ...this.currentPlayer.animations].filter(u => !u.isSpent && !u.isSuppressed);
        if (availableUnits.length > 0) {
            this.activeUnit = availableUnits[0];
            this.phase = "Action";
            this.ui.log(`Awaiting action from ${this.activeUnit.cardData.name}.`);
        } else {
            this.endTurn();
        }
    }
    
    passAction() {
        if (this.activeUnit) {
            this.ui.log(`${this.activeUnit.cardData.name} passes.`);
            this.activeUnit.isSpent = true;
        }
        this.findNextActionUnit();
        this.ui.render();
    }

    selectAction(actionType) {
        this.combatContext = { attacker: this.activeUnit, action: actionType };
        this.phase = "Fuel";
        this.ui.render();
    }
    
    selectFuel(card) {
        this.currentPlayer.discardCard(card);
        this.combatContext.fuelCard = card;
        this.phase = "Target";
        this.ui.log("Select a target.");
        this.ui.render();
    }
    
    isTargetable(unit) {
        if (this.phase !== 'Target') return false;
        const hasGuardians = this.opponent.animations.some(u => !u.isSuppressed);
        const attackerKeywords = this.combatContext.attacker.getKeywords();
        if (hasGuardians && !attackerKeywords.includes("Traveller")) {
            return unit.controller === this.opponent && unit.cardData.type === 'Animation';
        }
        return unit.controller === this.opponent;
    }

    selectTarget(unitId) {
        const target = this.players.flatMap(p => [p.actor, ...p.animations]).find(u => u.id === unitId);
        if (target && this.isTargetable(target)) {
            this.combatContext.defender = target;
            this.resolveCombat();
        }
    }
    
    resolveCombat() {
        const { attacker, defender, fuelCard, action } = this.combatContext;
        this.ui.log(`${attacker.cardData.name} attacks ${defender.cardData.name} with ${action}!`);
        
        let ev = attacker.getFocus() + fuelCard.power;
        if (attacker.getKeywords().includes("Aura")) ev++;
        let rv = defender.getFocus();
        
        this.ui.log(`EV: ${ev} vs RV: ${rv}`);
        
        if (ev > rv) {
            let damage = ev - rv;
            if (action === "Critical Strike" && attacker.getKeywords().includes("Brutal")) damage++;
            this.ui.log(`Hit! Dealing ${damage} damage.`);
            defender.damage += damage;
            
            if (defender.isDestroyed()) {
                this.ui.log(`${defender.cardData.name} is destroyed!`);
                if (defender.cardData.type === "Actor") {
                    this.phase = "Game Over";
                    this.ui.log(`Game Over! ${this.currentPlayer.name} wins!`);
                } else {
                    // Remove animation from play
                    const owner = defender.controller;
                    owner.animations = owner.animations.filter(anim => anim.id !== defender.id);
                }
            }
        } else {
            this.ui.log("Attack is blocked or misses!");
        }
        
        attacker.isSpent = true;
        if (this.phase !== "Game Over") {
            this.findNextActionUnit();
        }
        this.ui.render();
    }
    
    endTurn() {
        this.ui.log(`--- Turn ${this.turn} ends. ---`);
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 2;
        this.turn++;
        this.startTurn();
    }
}

// --- 5. INITIALIZE AND START THE GAME ---
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.start();
});