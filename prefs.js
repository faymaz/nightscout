// prefs.js
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class NightscoutPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create pages with icons
        const accountPage = this._createAccountPage(settings);
        accountPage.set_icon_name('user-info-symbolic');
        window.add(accountPage);

        const thresholdsPage = this._createThresholdsPage(settings);
        thresholdsPage.set_icon_name('preferences-system-symbolic');
        window.add(thresholdsPage);

        const displayPage = this._createDisplayPage(settings);
        displayPage.set_icon_name('preferences-desktop-display-symbolic');
        window.add(displayPage);

        // Set titles for pages
        accountPage.set_title('Account');
        thresholdsPage.set_title('Thresholds');
        displayPage.set_title('Display');
    }

    _createAccountPage(settings) {
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Nightscout Settings',
            description: 'Configure your Nightscout connection'
        });

        // URL
        const urlRow = new Adw.ActionRow({
            title: 'Nightscout URL',
            subtitle: 'Your Nightscout site URL (without trailing slash)'
        });
        const urlEntry = new Gtk.Entry({
            text: settings.get_string('nightscout-url'),
            valign: Gtk.Align.CENTER,
            hexpand: true
        });
        urlEntry.connect('changed', (entry) => {
            settings.set_string('nightscout-url', entry.get_text());
        });
        urlRow.add_suffix(urlEntry);
        group.add(urlRow);

        // Token
        const tokenRow = new Adw.ActionRow({
            title: 'API Token',
            subtitle: 'Your Nightscout API token'
        });
        const tokenEntry = new Gtk.Entry({
            text: settings.get_string('nightscout-token'),
            valign: Gtk.Align.CENTER,
            visibility: false,
            hexpand: true
        });
        tokenEntry.connect('changed', (entry) => {
            settings.set_string('nightscout-token', entry.get_text());
        });
        tokenRow.add_suffix(tokenEntry);
        group.add(tokenRow);

        page.add(group);
        return page;
    }

    _createThresholdsPage(settings) {
        const page = new Adw.PreferencesPage();
        
        // Thresholds Group
        const thresholdsGroup = new Adw.PreferencesGroup({
            title: 'Glucose Thresholds',
            description: 'Set glucose threshold values (mg/dL)'
        });
        page.add(thresholdsGroup);

        // Urgent High Threshold
        const urgentHighRow = this._createSpinRow(settings, 'urgent-high-threshold',
            'Urgent High Threshold', 'Value for urgent high alerts', 40, 400);
        thresholdsGroup.add(urgentHighRow);

        // High Threshold
        const highRow = this._createSpinRow(settings, 'high-threshold',
            'High Threshold', 'Value for high alerts', 40, 400);
        thresholdsGroup.add(highRow);

        // Low Threshold
        const lowRow = this._createSpinRow(settings, 'low-threshold',
            'Low Threshold', 'Value for low alerts', 40, 400);
        thresholdsGroup.add(lowRow);

        // Urgent Low Threshold
        const urgentLowRow = this._createSpinRow(settings, 'urgent-low-threshold',
            'Urgent Low Threshold', 'Value for urgent low alerts', 40, 400);
        thresholdsGroup.add(urgentLowRow);

        // Colors Group
        const colorsGroup = new Adw.PreferencesGroup({
            title: 'Threshold Colors',
            description: 'Customize colors for different glucose ranges'
        });
        page.add(colorsGroup);

        // Color settings
        const urgentHighColorRow = this._createColorRow(settings, 'urgent-high-color',
            'Urgent High Color');
        colorsGroup.add(urgentHighColorRow);

        const highColorRow = this._createColorRow(settings, 'high-color',
            'High Color');
        colorsGroup.add(highColorRow);

        const normalColorRow = this._createColorRow(settings, 'normal-color',
            'Normal Color');
        colorsGroup.add(normalColorRow);

        const lowColorRow = this._createColorRow(settings, 'low-color',
            'Low Color');
        colorsGroup.add(lowColorRow);

        const urgentLowColorRow = this._createColorRow(settings, 'urgent-low-color',
            'Urgent Low Color');
        colorsGroup.add(urgentLowColorRow);

        return page;
    }

    _createDisplayPage(settings) {
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Display Settings',
            description: 'Configure what information to show in the panel'
        });

        // Show Delta switch
        const deltaRow = new Adw.ActionRow({
            title: 'Show Delta',
            subtitle: 'Show glucose value change in the panel'
        });
        const deltaSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-delta'),
            valign: Gtk.Align.CENTER
        });
        deltaSwitch.connect('notify::active', (widget) => {
            settings.set_boolean('show-delta', widget.get_active());
        });
        deltaRow.add_suffix(deltaSwitch);
        group.add(deltaRow);

        // Show Trend Arrow switch
        const trendRow = new Adw.ActionRow({
            title: 'Show Trend Arrow',
            subtitle: 'Show trend arrow in the panel'
        });
        const trendSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-trend'),
            valign: Gtk.Align.CENTER
        });
        trendSwitch.connect('notify::active', (widget) => {
            settings.set_boolean('show-trend', widget.get_active());
        });
        trendRow.add_suffix(trendSwitch);
        group.add(trendRow);

        // Show Elapsed Time switch
        const timeRow = new Adw.ActionRow({
            title: 'Show Elapsed Time',
            subtitle: 'Show elapsed time since last reading in the panel'
        });
        const timeSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-time'),
            valign: Gtk.Align.CENTER
        });
        timeSwitch.connect('notify::active', (widget) => {
            settings.set_boolean('show-time', widget.get_active());
        });
        timeRow.add_suffix(timeSwitch);
        group.add(timeRow);

        // Show Icon switch
        const iconRow = new Adw.ActionRow({
            title: 'Show Icon',
            subtitle: 'Show Nightscout icon in the panel'
        });
        const iconSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-icon'),
            valign: Gtk.Align.CENTER
        });
        iconSwitch.connect('notify::active', (widget) => {
            settings.set_boolean('show-icon', widget.get_active());
        });
        iconRow.add_suffix(iconSwitch);
        group.add(iconRow);

        // Icon Position dropdown
        const positionRow = new Adw.ActionRow({
            title: 'Icon Position',
            subtitle: 'Position of the icon in panel'
        });
        const positionCombo = new Gtk.ComboBoxText({
            valign: Gtk.Align.CENTER
        });
        positionCombo.append('left', 'Left');
        positionCombo.append('right', 'Right');
        positionCombo.set_active_id(settings.get_string('icon-position'));
        positionCombo.connect('changed', (widget) => {
            settings.set_string('icon-position', widget.get_active_id());
        });
        positionRow.add_suffix(positionCombo);
        group.add(positionRow);

        page.add(group);
        return page;
    }

    _createSpinRow(settings, key, title, subtitle, min, max) {
        const row = new Adw.ActionRow({
            title: title,
            subtitle: subtitle
        });

        const spinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: min,
                upper: max,
                step_increment: 1
            }),
            value: settings.get_int(key),
            valign: Gtk.Align.CENTER,
            digits: 0
        });

        spinButton.connect('value-changed', (widget) => {
            settings.set_int(key, widget.get_value());
        });

        row.add_suffix(spinButton);
        return row;
    }

    _createColorRow(settings, key, title) {
        const row = new Adw.ActionRow({
            title: title
        });

        const colorButton = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
            use_alpha: false
        });

        const rgba = new Gdk.RGBA();
        rgba.parse(settings.get_string(key));
        colorButton.set_rgba(rgba);

        colorButton.connect('color-set', (widget) => {
            const color = widget.get_rgba().to_string();
            settings.set_string(key, color);
        });

        row.add_suffix(colorButton);
        return row;
    }
}
