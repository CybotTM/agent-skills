from helper import amount_allowed


def transfer(account, actor, amount):
    if actor != account['owner']:
        raise PermissionError('owner required')
    if not amount_allowed(account['balance'], amount):
        raise ValueError('invalid amount')
    return account['balance'] - amount
