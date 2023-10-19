// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.0/token/ERC20/IERC20.sol";
import {SafeERC20} from "@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.0/token/ERC20/utils/SafeERC20.sol";

// import "hardhat/console.sol";

contract Swapper {
    using SafeERC20 for IERC20;
    address fromToken;
    address toToken;
    uint256 fromAmount;
    uint256 toAmount;

    function setSwap(
        address _fromToken,
        address _toToken,
        uint256 _fromAmount,
        uint256 _toAmount
    ) public {
        fromToken = _fromToken;
        toToken = _toToken;
        fromAmount = _fromAmount;
        toAmount = _toAmount;
    }

    struct SimpleData {
        address fromToken;
        address toToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 expectedAmount;
        address[] callees;
        bytes exchangeData;
        uint256[] startIndexes;
        uint256[] values;
        address payable beneficiary;
        address payable partner;
        uint256 feePercent;
        bytes permit;
        uint256 deadline;
        bytes16 uuid;
    }

    // Paraswap like fn (all params are mocked
    function simpleSwap(SimpleData memory) public payable returns (uint256) {
        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), fromAmount);
        IERC20(toToken).safeTransfer(msg.sender, toAmount);

        return toAmount;
    }

    receive() external payable { }

    fallback() external payable {
        // console.log("Llego al Swapper");
        // console.logBytes(msg.data);
    }
}
