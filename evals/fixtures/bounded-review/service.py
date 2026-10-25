from check import valid


def debit(actor, owner, balance, amount):
    if actor != owner:
        raise PermissionError("owner required")
    if not valid(balance, amount):
        raise ValueError("invalid amount")
    return balance - amount
