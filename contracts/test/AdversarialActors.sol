// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IPool {
    function deposit() external payable;
    function withdrawAll() external;
}

/// @dev Test-only receiver; attempts a nested withdrawal but allows the outer payment.
contract ReentrantReceiver {
    IPool public immutable pool;
    bool public nestedSucceeded;
    constructor(address target) { pool = IPool(target); }
    function fund() external payable { pool.deposit{value: msg.value}(); }
    function redeem() external { pool.withdrawAll(); }
    receive() external payable {
        (nestedSucceeded, ) = address(pool).call(abi.encodeWithSignature("withdrawAll()"));
    }
}

contract RejectingReceiver {
    IPool public immutable pool;
    constructor(address target) { pool = IPool(target); }
    function fund() external payable { pool.deposit{value: msg.value}(); }
    function redeem() external { pool.withdrawAll(); }
    receive() external payable { revert("Cannot receive ETH"); }
}

/// @dev Test-only: forced ETH must not increase credited shares.
contract ForcedEther {
    constructor(address payable target) payable { selfdestruct(target); }
}
