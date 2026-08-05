class CTFViewManager extends SystemScript {
  _logEnabled: boolean;

  log(msg: string) {
    if (!this._logEnabled) return;
    console.log('[CTF-View] ' + msg);
  }

  onInit() {
    this._logEnabled = true;
    this.log('View init P' + playerManager.getMyPlayerId());
  }

  onSpriteClicked({ sprite }: { sprite: any }) {
    if (!sprite) return;
    const id = '' + (sprite.uniqueId || '');
    if (
      id === 'ctf_team_red_btn' ||
      id === 'ctf_team_blue_btn' ||
      id === 'ctf_team_green_btn' ||
      id === 'ctf_team_yellow_btn'
    ) {
      let team = '';
      if (id === 'ctf_team_red_btn') team = 'red';
      else if (id === 'ctf_team_blue_btn') team = 'blue';
      else if (id === 'ctf_team_green_btn') team = 'green';
      else if (id === 'ctf_team_yellow_btn') team = 'yellow';
      const pid = playerManager.getMyPlayerId();
      this.log('Emit playerSelectsTeam team=' + team + ' from P' + pid);
      // Emit both playerId and fromPlayerId for host flexibility
      eventManager.emit('playerSelectsTeam', {
        fromPlayerId: pid,
        playerId: pid,
        team: team,
      });
    } else if (id === 'ctf_start_btn') {
      const pid2 = playerManager.getMyPlayerId();
      this.log('Emit startGame from P' + pid2);
      eventManager.emit('startGame', { fromPlayerId: pid2, playerId: pid2 });
    } else if (id === 'ctf_restart_btn') {
      const pid3 = playerManager.getMyPlayerId();
      this.log('Emit restartGame from P' + pid3);
      eventManager.emit('restartGame', { fromPlayerId: pid3, playerId: pid3 });
    }
  }
}
