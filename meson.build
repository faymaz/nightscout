project('nightscout',
  version: '1.0',
  meson_version: '>= 0.59.0'
)

gnome = import('gnome')

schema_dir = join_paths(get_option('datadir'), 'glib-2.0', 'schemas')
extension_dir = join_paths(get_option('datadir'), 'gnome-shell', 'extensions', 'nightscout@faymaz.github.com')

install_data([
  'extension.js',
  'prefs.js',
  'metadata.json',
], install_dir: extension_dir)

install_data('org.gnome.shell.extensions.nightscout.gschema.xml',
  install_dir: schema_dir
)

meson.add_install_script('meson_post_install.py')