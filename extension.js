// extension.js
'use strict';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const TREND_ARROWS = {
    NONE: '→',
    DoubleUp: '↑↑',
    SingleUp: '↑',
    FortyFiveUp: '↗',
    Flat: '→',
    FortyFiveDown: '↘',
    SingleDown: '↓',
    DoubleDown: '↓↓',
    'NOT COMPUTABLE': '?',
    'RATE OUT OF RANGE': '⚠️'
};

const DELTA_THRESHOLDS = {
    VERY_FAST_RISE: 3,
    FAST_RISE: 2,
    MODERATE_RISE: 1,
    SLOW_RISE: 0.5,
    SLOW_FALL: -0.5,
    MODERATE_FALL: -1,
    FAST_FALL: -2,
    VERY_FAST_FALL: -3
};

const ALERT_SOUND_FILE = 'sounds/alert.mp3';
const UPDATE_INTERVAL = 60; // 60 seconds
const ERROR_TEXT = '⚠️ Error';
const LOADING_TEXT = '---';

const NightscoutIndicator = GObject.registerClass(
class NightscoutIndicator extends PanelMenu.Button {
    _init(settings, extension) {
        super._init(0.0, 'Nightscout Monitor');
        
        this._settings = settings;
        this._extension = extension;
        this._lastReading = null;
        this._timeout = null;
        this._isDestroyed = false;

        // Connect to settings changes
        this._settingsChangedId = this._settings.connect('changed', () => {
            this._updateDisplay();
        });

        this._createUI();
        this._startMonitoring();
    }

    _updateDisplay() {
        // Update UI based on current settings
        const showIcon = this._settings.get_boolean('show-icon');
        this.icon.visible = showIcon;

        if (this._lastReading) {
            this._updatePanelText(this._lastReading);
        }
    }

    _updatePanelText(reading) {
        let displayText = `${reading.sgv}`;

        if (this._settings.get_boolean('show-delta') && reading.delta) {
            displayText += ` (${reading.delta})`;
        }

        if (this._settings.get_boolean('show-trend') && reading.direction) {
            displayText += ` ${TREND_ARROWS[reading.direction] || '?'}`;
        }

        if (this._settings.get_boolean('show-time')) {
            const time = new Date(reading.dateString);
            displayText += ` [${this._formatElapsedTime(time)}]`;
        }

        this.label.set_text(displayText);
    }
    
    _createUI() {
        try {
            // Build UI
            this.boxLayout = new St.BoxLayout({ 
                style_class: 'panel-status-menu-box' 
            });

            this.icon = new St.Icon({
                gicon: Gio.Icon.new_for_string(`${this._extension.path}/icons/icon.png`),
                style_class: 'system-status-icon'
            });

            this.label = new St.Label({
                text: LOADING_TEXT,
                y_align: Clutter.ActorAlign.CENTER
            });

            this.boxLayout.add_child(this.icon);
            this.boxLayout.add_child(this.label);
            this.add_child(this.boxLayout);

            // Setup audio player
            this._player = global.display.get_sound_player();
            this._alertSound = Gio.File.new_for_path(
                GLib.build_filenamev([this._extension.path, ALERT_SOUND_FILE])
            );
            // Handle icon position
            const position = this._settings.get_string('icon-position');
            const showIcon = this._settings.get_boolean('show-icon');
            // Add menu items
            this.menuItem = new PopupMenu.PopupMenuItem(`Last reading: ${LOADING_TEXT}`);
            this.menu.addMenuItem(this.menuItem);

            this.deltaItem = new PopupMenu.PopupMenuItem(`Delta: ${LOADING_TEXT}`);
            this.menu.addMenuItem(this.deltaItem);

            this.trendItem = new PopupMenu.PopupMenuItem(`Trend: ${LOADING_TEXT}`);
            this.menu.addMenuItem(this.trendItem);

            this.elapsedTimeItem = new PopupMenu.PopupMenuItem(`Time: ${LOADING_TEXT}`);
            this.menu.addMenuItem(this.elapsedTimeItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Add Refresh button
            const refreshButton = new PopupMenu.PopupMenuItem('Refresh Now');
            refreshButton.connect('activate', () => {
                this._updateGlucose().catch(log);
            });
            this.menu.addMenuItem(refreshButton);

            // Add Settings button
            const settingsButton = new PopupMenu.PopupMenuItem('Open Settings');
            settingsButton.connect('activate', () => {
                this._extension.openPreferences();
            });
            this.menu.addMenuItem(settingsButton);
        } catch (error) {
            logError('Error creating UI:', error);
        }
    }

    _getColorForGlucose(sgv) {
        const urgentHighThreshold = this._settings.get_int('urgent-high-threshold');
        const highThreshold = this._settings.get_int('high-threshold');
        const lowThreshold = this._settings.get_int('low-threshold');
        const urgentLowThreshold = this._settings.get_int('urgent-low-threshold');

        if (sgv >= urgentHighThreshold) {
            return this._settings.get_string('urgent-high-color');
        } else if (sgv >= highThreshold) {
            return this._settings.get_string('high-color');
        } else if (sgv <= urgentLowThreshold) {
            return this._settings.get_string('urgent-low-color');
        } else if (sgv <= lowThreshold) {
            return this._settings.get_string('low-color');
        } else {
            return this._settings.get_string('normal-color');
        }
    }

    _startMonitoring() {
        try {
            // Initial update
            this._updateGlucose().catch(log);

            // Update periodically
            this._timeout = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                UPDATE_INTERVAL,
                () => {
                    if (this._isDestroyed) {
                        return GLib.SOURCE_REMOVE;
                    }
                    this._updateGlucose().catch(log);
                    return GLib.SOURCE_CONTINUE;
                }
            );
        } catch (error) {
            logError('Error starting monitoring:', error);
        }
    }

    async _updateGlucose() {
        if (this._isDestroyed) return;

        try {
            const nsUrl = this._settings.get_string('nightscout-url');
            const nsToken = this._settings.get_string('nightscout-token');

            if (!nsUrl || !nsToken) {
                this.label.set_text('⚠️ Settings');
                return;
            }

            const baseUrl = nsUrl.replace(/\/$/, '');
            const token = nsToken.replace(/^\/?[?]token=/, '');
            const url = `${baseUrl}/api/v1/entries.json?count=2`;

            const session = new Soup.Session();
            const message = Soup.Message.new('GET', url);

            message.request_headers.append('api-secret', token);
            message.request_headers.append('Accept', 'application/json');

            const bytes = await session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null
            );

            if (message.status_code !== 200) {
                throw new Error(`HTTP error! status: ${message.status_code}`);
            }

            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(bytes.get_data());
            const data = JSON.parse(text);

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No glucose data available');
            }

            const latest = data[0];
            const sgv = latest.sgv;
            const calculatedTrend = this._calculateTrendArrow(data);
            const direction = TREND_ARROWS[calculatedTrend] || '?';
            const delta = this._calculateDelta(data);
            const time = new Date(latest.dateString);
            const elapsedTime = this._formatElapsedTime(time);
            
            const color = this._getColorForGlucose(sgv);
            this.label.set_style(`color: ${color};`);

            let displayText = `${sgv}`;

            if (this._settings.get_boolean('show-delta') && delta) {
                displayText += ` (${delta})`;
            }

            if (this._settings.get_boolean('show-trend')) {
                displayText += ` ${direction}`;
            }

            if (this._settings.get_boolean('show-time')) {
                displayText += ` [${elapsedTime}]`;
            }

            if (!this._isDestroyed) {
                this.label.set_text(displayText);
                this.label.set_style(`color: ${color};`);

                // Update menu items
                this.menuItem.label.set_text(`Last reading: ${sgv} mg/dL`);
                this.deltaItem.label.set_text(`Delta: ${delta} mg/dL`);
                this.trendItem.label.set_text(`Trend: ${calculatedTrend}`);
                this.elapsedTimeItem.label.set_text(`Time: ${elapsedTime}`);

                this._lastReading = latest;
            }

        } catch (error) {
            logError('Nightscout Error:', error);
            if (!this._isDestroyed) {
                this.label.set_text(ERROR_TEXT);
                this.label.set_style('color: red;');
            }
        }
    }

    _calculateTrendArrow(readings) {
        if (!Array.isArray(readings) || readings.length < 2) return 'NONE';

        try {
            const current = readings[0].sgv;
            const previous = readings[1].sgv;
            const timeDiff = (new Date(readings[0].dateString) - new Date(readings[1].dateString)) / 1000 / 60;
            const rateOfChange = (current - previous) / timeDiff;

            if (rateOfChange >= DELTA_THRESHOLDS.VERY_FAST_RISE) return 'DoubleUp';
            if (rateOfChange >= DELTA_THRESHOLDS.FAST_RISE) return 'SingleUp';
            if (rateOfChange >= DELTA_THRESHOLDS.MODERATE_RISE) return 'FortyFiveUp';
            if (rateOfChange <= DELTA_THRESHOLDS.VERY_FAST_FALL) return 'DoubleDown';
            if (rateOfChange <= DELTA_THRESHOLDS.FAST_FALL) return 'SingleDown';
            if (rateOfChange <= DELTA_THRESHOLDS.MODERATE_FALL) return 'FortyFiveDown';
            return 'Flat';
        } catch (error) {
            logError('Error calculating trend:', error);
            return 'NONE';
        }
    }

    _calculateDelta(readings) {
        if (!Array.isArray(readings) || readings.length < 2) return null;
        try {
            const delta = readings[0].sgv - readings[1].sgv;
            return delta > 0 ? `+${delta}` : `${delta}`;
        } catch (error) {
            logError('Error calculating delta:', error);
            return null;
        }
    }

    _formatElapsedTime(date) {
        try {
            const now = new Date();
            const diff = now - date;
            const minutes = Math.floor(diff / 60000);
            
            if (minutes < 1) return 'just now';
            if (minutes === 1) return '1 minute ago';
            if (minutes < 60) return `${minutes} minutes ago`;
            
            const hours = Math.floor(minutes / 60);
            if (hours === 1) return '1 hour ago';
            return `${hours} hours ago`;
        } catch (error) {
            logError('Error formatting time:', error);
            return 'unknown';
        }
    }

    _playAlert() {
        try {
            if (this._alertSound.query_exists(null)) {
                this._player.play_from_file(this._alertSound, 'Nightscout Alert', null);
            }
        } catch (error) {
            logError('Error playing alert:', error);
        }
    }

    destroy() {
        this._isDestroyed = true;

        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }

        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        super.destroy();
    }
});

export default class NightscoutExtension extends Extension {
    enable() {
        try {
            this._settings = this.getSettings();
            this._indicator = new NightscoutIndicator(this._settings, this);
            const position = this._settings.get_string('icon-position');
            
            // Use -1 for right position to ensure consistent placement
            if (position === 'left') {
                Main.panel.addToStatusArea('nightscout-indicator', this._indicator, 0, 'left');
            } else {
                Main.panel.addToStatusArea('nightscout-indicator', this._indicator, -1, 'right');
            }
        } catch (error) {
            logError('Error enabling extension:', error);
        }
    }

    disable() {
        try {
            if (this._indicator) {
                this._indicator.destroy();
                this._indicator = null;
            }
            this._settings = null;
        } catch (error) {
            logError('Error disabling extension:', error);
        }
    }
}