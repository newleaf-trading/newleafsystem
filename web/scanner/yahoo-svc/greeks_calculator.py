"""
Greeks Calculator — Black-Scholes Model
"""
import numpy as np
from scipy.stats import norm
from datetime import datetime

def calculate_greeks(S, K, T, r, sigma, option_type='call'):
    if T <= 0 or sigma <= 0:
        return {'delta': 0.0, 'gamma': 0.0, 'theta': 0.0, 'vega': 0.0, 'rho': 0.0}
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
    vega  = S * norm.pdf(d1) * np.sqrt(T) / 100
    if option_type.lower() == 'call':
        delta = norm.cdf(d1)
        theta = (-(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) - r * K * np.exp(-r * T) * norm.cdf(d2)) / 365
        rho   = K * T * np.exp(-r * T) * norm.cdf(d2) / 100
    else:
        delta = -norm.cdf(-d1)
        theta = (-(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) + r * K * np.exp(-r * T) * norm.cdf(-d2)) / 365
        rho   = -K * T * np.exp(-r * T) * norm.cdf(-d2) / 100
    return {'delta': round(delta, 4), 'gamma': round(gamma, 4), 'theta': round(theta, 4), 'vega': round(vega, 4), 'rho': round(rho, 4)}

def days_to_expiration(expiry_str):
    try:
        return max(0, (datetime.strptime(expiry_str, '%Y-%m-%d') - datetime.now()).days)
    except:
        return 0

def years_to_expiration(expiry_str):
    return days_to_expiration(expiry_str) / 365.0
