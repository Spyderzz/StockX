import re

def patch_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    replacements = {
        "'SUZLON', price: 45.2": "'SUZLON', full_name: 'Suzlon Energy Limited', price: 45.2",
        "'RELIANCE', price: 2847.5": "'RELIANCE', full_name: 'Reliance Industries Limited', price: 2847.5",
        "'TATASTEEL', price: 136.8": "'TATASTEEL', full_name: 'Tata Steel Limited', price: 136.8",
        "'HDFCBANK', price: 1623.4": "'HDFCBANK', full_name: 'HDFC Bank Limited', price: 1623.4",
        "'INFY', price: 1481.3": "'INFY', full_name: 'Infosys Limited', price: 1481.3"
    }

    for k, v in replacements.items():
        content = content.replace(k, v)

    with open(filepath, 'w') as f:
        f.write(content)

patch_file('frontend/src/pages/AnalysePage.jsx')
patch_file('frontend/src/pages/LandingPage.jsx')

