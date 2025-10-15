cd /app/EasyMocap

# Backup the original
cp config/fit/1v1p-mirror-direct.yml config/fit/1v1p-mirror-direct.yml.backup

# Disable rendering in the config
python3 << 'PYTHON_EOF'
import yaml

with open('config/fit/1v1p-mirror-direct.yml', 'r') as f:
    config = yaml.safe_load(f)

# Navigate to the writer section and disable rendering
if 'args' in config and 'writer' in config['args']:
    if 'render' in config['args']['writer']:
        config['args']['writer']['render']['enable'] = False
    else:
        config['args']['writer']['render'] = {'enable': False}

with open('config/fit/1v1p-mirror-direct.yml', 'w') as f:
    yaml.dump(config, f)

print("Config updated - rendering disabled")
PYTHON_EOF

# Now run the original command
python3 apps/demo/mocap.py /app/data/ --work mirror --fps 30 --vis_scale 0.5