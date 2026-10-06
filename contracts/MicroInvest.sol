// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title MicroInvest
/// @notice Testnet educational pool: 1 ETH = 1 share; no yield, fees, transfers or administrator.
/// @dev Shares have 18 decimals and are stored in wei-sized units, so conversion is exact.
contract MicroInvest {
    mapping(address => uint256) public shares;
    uint256 public totalShares;
    uint256 private entered;

    error ZeroAmount();
    error InsufficientShares();
    error TransferFailed();
    error ReentrantCall();

    event Deposited(address indexed investor, uint256 amountWei, uint256 sharesAfter);
    event Withdrawn(address indexed investor, uint256 amountWei, uint256 sharesAfter);

    modifier nonReentrant() {
        if (entered != 0) revert ReentrantCall();
        entered = 1;
        _;
        entered = 0;
    }

    function deposit() external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        shares[msg.sender] += msg.value;
        totalShares += msg.value;
        emit Deposited(msg.sender, msg.value, shares[msg.sender]);
    }

    function withdraw(uint256 amountWei) external nonReentrant {
        _withdraw(amountWei);
    }

    function withdrawAll() external nonReentrant {
        _withdraw(shares[msg.sender]);
    }

    function _withdraw(uint256 amountWei) private {
        if (amountWei == 0) revert ZeroAmount();
        uint256 owned = shares[msg.sender];
        if (amountWei > owned) revert InsufficientShares();
        shares[msg.sender] = owned - amountWei;
        totalShares -= amountWei;
        (bool sent, ) = payable(msg.sender).call{value: amountWei}("");
        if (!sent) revert TransferFailed();
        emit Withdrawn(msg.sender, amountWei, shares[msg.sender]);
    }
}
