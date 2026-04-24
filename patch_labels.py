import re

with open('backend/main.py', 'r') as f:
    content = f.read()

# Update Signal Intelligence labels
content = content.replace('setup_label = "GOOD SETUP"', 'setup_label = "STRONG SETUP"')
content = content.replace('setup_label = "AVERAGE"', 'setup_label = "NEUTRAL SETUP"')
content = content.replace('setup_label = "POOR SETUP"', 'setup_label = "WEAK SETUP"')

# Update Pump & Dump labels
content = content.replace('anomaly_label = "HIGH RISK"', 'anomaly_label = "MANIPULATION RISK"')
content = content.replace('anomaly_label = "SUSPICIOUS"', 'anomaly_label = "UNUSUAL ACTIVITY"')
content = content.replace('anomaly_label = "CLEAN"', 'anomaly_label = "ORGANIC ACTION"')

with open('backend/main.py', 'w') as f:
    f.write(content)
